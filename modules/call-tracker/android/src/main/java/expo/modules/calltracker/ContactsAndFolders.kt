package expo.modules.calltracker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.provider.DocumentsContract
import androidx.core.content.ContextCompat

/** Names for numbers, and numbers for names, from the phone's own contacts. */
object Contacts {
  private fun allowed(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

  fun nameFor(context: Context, number: String): String? {
    if (!allowed(context) || number.isBlank()) return null
    val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
    return try {
      context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
        ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    } catch (_: Exception) {
      null
    }
  }

  /**
   * The number saved under exactly this name. WhatsApp's call notification
   * shows a saved contact's name, not their number; this turns it back.
   * Null when no contact, or more than one, has the name.
   */
  fun numberFor(context: Context, name: String): String? {
    if (!allowed(context) || name.isBlank()) return null
    val numbers = mutableSetOf<String>()
    try {
      context.contentResolver.query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        arrayOf(ContactsContract.CommonDataKinds.Phone.NORMALIZED_NUMBER, ContactsContract.CommonDataKinds.Phone.NUMBER),
        "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} = ?",
        arrayOf(name),
        null
      )?.use { c ->
        while (c.moveToNext()) {
          val n = c.getString(0) ?: c.getString(1)
          if (!n.isNullOrBlank()) numbers += n.filter { it.isDigit() || it == '+' }.takeLast(13)
        }
      }
    } catch (_: Exception) {
      return null
    }
    // one person, maybe saved twice with the same number; two different numbers is ambiguous
    val distinct = numbers.map { it.filter(Char::isDigit).takeLast(10) }.toSet()
    return if (distinct.size == 1) numbers.first() else null
  }
}

/**
 * A recording folder the rep picked by hand (Storage Access Framework). Some
 * brands keep call recordings where the media index can't see them — behind a
 * .nomedia file, or in app-private storage — and picking the folder is the
 * only way to read them.
 */
object RecordingFolder {
  private const val KEY = "recordingFolderUri"

  fun saved(context: Context): String? = Prefs.of(context).getString(KEY, null)

  fun save(context: Context, uri: String?) {
    Prefs.of(context).edit().putString(KEY, uri).apply()
  }

  /** Whether the saved folder can still be read (the grant can be revoked in settings). */
  fun readable(context: Context): Boolean {
    val uri = saved(context) ?: return false
    return context.contentResolver.persistedUriPermissions.any { it.uri.toString() == uri && it.isReadPermission }
  }

  /** A readable name for the picked folder, e.g. "Recordings/Call". */
  fun label(uri: String): String {
    val doc = try {
      DocumentsContract.getTreeDocumentId(Uri.parse(uri))
    } catch (_: Exception) {
      return ""
    }
    return doc.substringAfter(':', doc)
  }

  /**
   * The best recording for the call among the folder's files (and one level of
   * sub-folders, where some diallers file by date or contact), scored the same
   * way as [RecordingFinder].
   */
  fun find(context: Context, number: String, startedAtMs: Long, durationSec: Int, contactName: String?): Map<String, Any?>? {
    val tree = saved(context)?.let(Uri::parse) ?: return null
    if (!readable(context)) return null
    val digits = number.filter(Char::isDigit).takeLast(10)
    val from = startedAtMs - 60_000
    val until = startedAtMs + durationSec * 1000L + 600_000
    val scorer = RecordingFinder(context)
    var best: Map<String, Any?>? = null
    var bestScore = 0

    fun scan(parentDocId: String, depth: Int) {
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId)
      val cols = arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        DocumentsContract.Document.COLUMN_SIZE
      )
      context.contentResolver.query(children, cols, null, null, null)?.use { c ->
        while (c.moveToNext()) {
          val id = c.getString(0)
          val name = c.getString(1).orEmpty()
          val mime = c.getString(2).orEmpty()
          val modified = c.getLong(3)
          val size = c.getLong(4)
          if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
            if (depth < 1) scan(id, depth + 1)
            continue
          }
          if (!mime.startsWith("audio/") && !name.matches(Regex(".*\\.(m4a|mp3|amr|aac|wav|ogg|opus|3gp)$", RegexOption.IGNORE_CASE))) continue
          // a recording is written as the call ends, so it is modified inside the call's window
          if (modified !in from..until || size <= 0) continue
          // the folder was picked as the recordings folder: that is the folder evidence
          val endedAt = startedAtMs + durationSec * 1000L
          // finished writing within a minute and a half of the call ending
          val closeToEnd = if (kotlin.math.abs(modified - endedAt) <= 90_000) 3 else 0
          val score = scorer.score(name, "call recordings", 0, digits, contactName, durationSec) + closeToEnd
          if (score > bestScore) {
            bestScore = score
            best = mapOf(
              "uri" to DocumentsContract.buildDocumentUriUsingTree(tree, id).toString(),
              "name" to name,
              "folder" to label(tree.toString()),
              "bytes" to size.toDouble(),
              "mime" to mime.ifBlank { "audio/mpeg" },
              "durationSec" to 0,
              "score" to score
            )
          }
        }
      }
    }

    return try {
      scan(DocumentsContract.getTreeDocumentId(tree), 0)
      best?.takeIf { bestScore >= RecordingFinder.MIN_SCORE }
    } catch (_: Exception) {
      null
    }
  }
}
