import { useEffect, useState, type MutableRefObject } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Svg, { Path, Rect } from "react-native-svg";
import { apiErrorMessage } from "@api/apiClient";
import { callsApi } from "../api/callsApi";
import { environment } from "@config/env";
import { clock } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Text } from "@shared/ui";

/** The API's origin: signed media links are paths on it, not under /api/v1. */
const ORIGIN = environment.apiUrl.replace(/\/api\/v1\/?$/, "");

type Seek = { sec: number; n: number } | null;
/** Where the player is, for "comment at this moment"; written without re-rendering anyone. */
export type PositionRef = MutableRefObject<number>;

function Player({ uri, fallbackSec, seek, marks, positionRef }: { uri: string; fallbackSec: number; seek: Seek; marks: number[]; positionRef?: PositionRef }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(1);
  const duration = status.duration || fallbackSec;
  const at = status.currentTime || 0;
  const progress = duration ? Math.min(1, at / duration) : 0;
  const skip = (d: number) => player.seekTo(Math.max(0, Math.min(duration, at + d)));

  useEffect(() => {
    if (positionRef) positionRef.current = at;
  }, [at, positionRef]);

  // the rep already pressed play once, to load it; don't make them press it twice
  useEffect(() => {
    player.play();
  }, [player]);

  // a transcript line or objection was tapped: jump there and play
  useEffect(() => {
    if (!seek) return;
    player.seekTo(seek.sec);
    player.play();
  }, [seek, player]);

  return (
    <View style={styles.player}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause recording" : "Play recording"}
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={styles.play}
      >
        <Svg width={14} height={14} viewBox="0 0 16 16">
          {status.playing ? (
            <>
              <Rect x={3.5} y={3} width={3} height={10} fill={palette.paper} />
              <Rect x={9.5} y={3} width={3} height={10} fill={palette.paper} />
            </>
          ) : (
            <Path d="M5 3.5v9l7-4.5z" fill={palette.paper} />
          )}
        </Svg>
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={`Position ${clock(at)} of ${clock(duration)}`}
          onLayout={(e) => setTrackWidth(Math.max(1, e.nativeEvent.layout.width))}
          onPress={(e) => duration && player.seekTo((e.nativeEvent.locationX / trackWidth) * duration)}
          style={styles.track}
        >
          <View style={styles.rail} />
          {duration
            ? marks
                .filter((m) => m <= duration)
                .map((m, i) => <View key={`${m}-${i}`} style={[styles.mark, { left: `${(m / duration) * 100}%` }]} />)
            : null}
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          <View style={[styles.knob, { left: `${progress * 100}%` }]} />
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{clock(at)}</Text>
          <View style={styles.skips}>
            <Pressable onPress={() => skip(-10)} accessibilityRole="button" accessibilityLabel="Back 10 seconds" hitSlop={6}>
              <Text style={styles.skip}>−10s</Text>
            </Pressable>
            <Pressable onPress={() => skip(10)} accessibilityRole="button" accessibilityLabel="Forward 10 seconds" hitSlop={6}>
              <Text style={styles.skip}>+10s</Text>
            </Pressable>
          </View>
          <Text style={styles.time}>{clock(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Plays a call's recording. The link is fetched only when asked for — it's a
 * signed URL that expires in ten minutes — so opening a call never downloads
 * audio nobody listens to.
 */
export function RecordingPlayer({
  callId,
  status,
  durationSec,
  seek = null,
  marks = [],
  positionRef,
}: {
  callId: string;
  status: string;
  durationSec: number;
  seek?: Seek;
  /** Moments with a review comment, ticked on the rail. */
  marks?: number[];
  positionRef?: PositionRef;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSeek, setLastSeek] = useState<Seek>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUri(`${ORIGIN}${await callsApi.recordingUrl(callId)}`);
    } catch (e) {
      setError(apiErrorMessage(e, "The recording couldn’t be loaded."));
    } finally {
      setLoading(false);
    }
  }

  // a transcript line tapped before the player was opened opens it
  if (seek && seek !== lastSeek) {
    setLastSeek(seek);
    if (!uri && !loading && status === "uploaded") void load();
  }

  if (status !== "uploaded") {
    return (
      <View style={styles.box}>
        <Text variant="label">Recording</Text>
        <Text variant="caption" tone="secondary">
          {status === "pending" ? "Uploading from the phone…" : "No recording for this call. The phone may not record calls, or the file wasn’t found."}
        </Text>
      </View>
    );
  }

  if (uri) {
    return (
      <View style={styles.box}>
        <Text variant="label">Recording</Text>
        <Player uri={uri} fallbackSec={durationSec} seek={seek} marks={marks} positionRef={positionRef} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text variant="label">Recording</Text>
      {error ? (
        <Text variant="caption" tone="missed">
          {error}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={load} style={styles.load}>
        <View style={styles.play}>
          <Svg width={14} height={14} viewBox="0 0 16 16">
            <Path d="M5 3.5v9l7-4.5z" fill={palette.paper} />
          </Svg>
        </View>
        <Text variant="bodyMedium">{loading ? "Loading…" : `Play recording · ${clock(durationSec)}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, borderRadius: radius.md, backgroundColor: palette.paper, gap: space.sm },
  load: { flexDirection: "row", alignItems: "center", gap: space.md },
  player: { flexDirection: "row", alignItems: "center", gap: space.md },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  track: { height: 18, justifyContent: "center" },
  rail: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: palette.ruleStrong },
  mark: { position: "absolute", top: 1, width: 4, height: 16, marginLeft: -2, borderRadius: 1, backgroundColor: palette.marker, borderWidth: 1, borderColor: palette.ink },
  fill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: palette.ink },
  knob: { position: "absolute", width: 12, height: 12, borderRadius: 6, marginLeft: -6, backgroundColor: palette.ink, borderWidth: 2, borderColor: palette.paper },
  times: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink3 },
  skips: { flexDirection: "row", gap: space.md },
  skip: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: palette.ink2 },
});
