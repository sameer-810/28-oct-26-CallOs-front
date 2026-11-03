package expo.modules.calltracker

import android.content.ContentUris
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import kotlin.math.abs

/**
 * Finds the file a phone's own dialler recorded for a call.
 *
 * Every brand saves somewhere different (MIUI/sound_recorder/call_rec,
 * Recordings/Call, Music/Recordings/Call Recordings, Record/Call…), and names
 * files after the number, the contact, or just a timestamp. So rather than a
 * list of paths per model, candidates are the audio files created around the
 * call, scored on the evidence that ties them to it.
 */
class RecordingFinder(private val context: Context) {

  private val folderHints = listOf("call", "record", "rec", "sound_recorder", "phonerecord")

  fun find(number: String, startedAtMs: Long, durationSec: Int, contactName: String?): Map<String, Any?>? {
    val digits = number.filter(Char::isDigit).takeLast(10)
    val from = startedAtMs / 1000 - 60
    val until = startedAtMs / 1000 + durationSec + 600

    val cols = buildList {
      add(MediaStore.Audio.Media._ID)
      add(MediaStore.Audio.Media.DISPLAY_NAME)
      add(MediaStore.Audio.Media.SIZE)
      add(MediaStore.Audio.Media.MIME_TYPE)
      add(MediaStore.Audio.Media.DURATION)
      add(MediaStore.Audio.Media.DATE_ADDED)
      if (Build.VERSION.SDK_INT >= 29) add(MediaStore.Audio.Media.RELATIVE_PATH)
    }.toTypedArray()

    var best: Map<String, Any?>? = null
    var bestScore = 0
    context.contentResolver.query(
      MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
      cols,
      "${MediaStore.Audio.Media.DATE_ADDED} BETWEEN ? AND ?",
      arrayOf(from.toString(), until.toString()),
      "${MediaStore.Audio.Media.DATE_ADDED} ASC"
    )?.use { c ->
      while (c.moveToNext()) {
        val id = c.getLong(0)
        val name = c.getString(1).orEmpty()
        val size = c.getLong(2)
        val mime = c.getString(3).orEmpty()
        val lengthSec = (c.getLong(4) / 1000).toInt()
        val path = if (cols.size > 6) c.getString(6).orEmpty() else ""
        val score = score(name, path, lengthSec, digits, contactName, durationSec)
        if (score > bestScore && size > 0) {
          bestScore = score
          best = mapOf(
            "uri" to ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id).toString(),
            "name" to name,
            "folder" to path,
            "bytes" to size.toDouble(),
            "mime" to mime,
            "durationSec" to lengthSec,
            "score" to score
          )
        }
      }
    }
    // a lone file in the window with no other evidence is not a match
    return best?.takeIf { bestScore >= MIN_SCORE }
  }

  internal fun score(
    fileName: String,
    folder: String,
    lengthSec: Int,
    digits: String,
    contactName: String?,
    callSec: Int
  ): Int {
    val name = fileName.lowercase()
    val dir = folder.lowercase()
    var s = 0
    if (folderHints.any { dir.contains(it) }) s += 3
    if (digits.length >= 7 && name.filter(Char::isDigit).contains(digits.takeLast(7))) s += 5
    val contact = contactName?.lowercase()?.trim().orEmpty()
    if (contact.length >= 3 && name.replace('_', ' ').contains(contact)) s += 4
    if (callSec > 0 && lengthSec > 0) {
      val off = abs(lengthSec - callSec)
      s += when {
        off <= 3 -> 4
        off <= 10 -> 2
        else -> 0
      }
    }
    return s
  }

  companion object {
    const val MIN_SCORE = 5
  }
}
