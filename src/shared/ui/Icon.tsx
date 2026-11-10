import Svg, { Circle, Path } from "react-native-svg";
import { palette } from "../designSystem";

export type IconName =
  | "home"
  | "team"
  | "account"
  | "calls"
  | "copy"
  | "share"
  | "check"
  | "search"
  | "logout"
  | "chart"
  | "spark"
  | "settings"
  | "more"
  | "bell"
  | "book"
  | "message"
  | "card"
  | "sync"
  | "shield"
  | "phone"
  | "sms"
  | "whatsapp"
  | "play"
  | "dialpad"
  | "sim"
  | "folder"
  | "help"
  | "wrench"
  | "trash"
  | "close"
  | "clock"
  | "calendar"
  | "alert"
  | "backspace"
  | "rocket"
  | "chevron"
  | "bolt";

/** A handful of line icons drawn for this app, 1.6px strokes on a 20px grid. */
export function Icon({ name, size = 20, color = palette.ink }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no">
      {name === "home" && <Path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z" {...p} />}
      {name === "team" && (
        <>
          <Circle cx={7.5} cy={7} r={2.6} {...p} />
          <Path d="M2.5 16c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" {...p} />
          <Path d="M12.5 4.6a2.6 2.6 0 0 1 0 4.9M14 12.2c1.7.5 3 1.8 3.5 3.8" {...p} />
        </>
      )}
      {name === "account" && (
        <>
          <Circle cx={10} cy={7.5} r={3} {...p} />
          <Path d="M4 17c.8-3 3.1-4.6 6-4.6s5.2 1.6 6 4.6" {...p} />
        </>
      )}
      {name === "calls" && (
        <Path d="M6 3.5c-1 0-2.5 1-2.5 2.5C3.5 12 8 16.5 14 16.5c1.5 0 2.5-1.5 2.5-2.5v-1.5l-3.2-1.4-1.6 1.6c-1.8-.9-3.5-2.6-4.4-4.4l1.6-1.6L7.5 3.5z" {...p} />
      )}
      {name === "copy" && (
        <>
          <Path d="M7 7h8.5v9.5H7z" {...p} />
          <Path d="M4.5 13V3.5H13" {...p} />
        </>
      )}
      {name === "share" && <Path d="M10 3v10M6 6.5 10 3l4 3.5M4 11v5.5h12V11" {...p} />}
      {name === "check" && <Path d="M4 10.5 8 14.5 16 5.5" {...p} />}
      {name === "search" && (
        <>
          <Circle cx={9} cy={9} r={5} {...p} />
          <Path d="m13 13 4 4" {...p} />
        </>
      )}
      {name === "logout" && <Path d="M8 4H4v12h4M12 6.5 15.5 10 12 13.5M15.5 10H8" {...p} />}
      {name === "chart" && <Path d="M3.5 16.5h13M5.5 13.5V9M9 13.5V4.5M12.5 13.5v-6M16 13.5V11" {...p} />}
      {name === "spark" && <Path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2" {...p} />}
      {name === "settings" && (
        <>
          <Circle cx={10} cy={10} r={2.6} {...p} />
          <Path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4" {...p} />
        </>
      )}
      {name === "bell" && (
        <>
          <Path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13z" {...p} />
          <Path d="M8.2 17.2a2 2 0 0 0 3.6 0" {...p} />
        </>
      )}
      {name === "book" && (
        <>
          <Path d="M10 5.5C8.5 4.3 6.3 4 3.5 4v11.5c2.8 0 5 .3 6.5 1.5 1.5-1.2 3.7-1.5 6.5-1.5V4c-2.8 0-5 .3-6.5 1.5z" {...p} />
          <Path d="M10 5.5V17" {...p} />
        </>
      )}
      {name === "message" && <Path d="M4 15.5 5 12.6A6.2 6.2 0 1 1 7.6 15zM7.5 8.3c.3 1.9 2.3 3.9 4.2 4.2l1.1-1.1-1.4-.9-.7.6c-.7-.3-1.4-1-1.7-1.7l.6-.7-.9-1.4z" {...p} />}
      {name === "card" && (
        <>
          <Path d="M3 5.5h14v9H3z" {...p} />
          <Path d="M3 8.5h14M6 12h3" {...p} />
        </>
      )}
      {name === "more" && (
        <>
          <Circle cx={4.5} cy={10} r={1.2} {...p} />
          <Circle cx={10} cy={10} r={1.2} {...p} />
          <Circle cx={15.5} cy={10} r={1.2} {...p} />
        </>
      )}
      {name === "sync" && (
        <>
          <Path d="M15.5 8A5.6 5.6 0 0 0 5.2 6.2L4 7.5M4.5 12a5.6 5.6 0 0 0 10.3 1.8L16 12.5" {...p} />
          <Path d="M4 4v3.5h3.5M16 16v-3.5h-3.5" {...p} />
        </>
      )}
      {name === "shield" && <Path d="M10 2.8 4 5v4.6c0 3.6 2.5 6.4 6 7.6 3.5-1.2 6-4 6-7.6V5z" {...p} />}
      {name === "phone" && (
        <Path d="M6.6 3.5H4.8a1.3 1.3 0 0 0-1.3 1.4c.5 6 5.3 10.8 11.3 11.3a1.3 1.3 0 0 0 1.4-1.3v-1.8l-3.2-1.3-1.5 1.5a8.3 8.3 0 0 1-3.8-3.8L9.2 8z" {...p} />
      )}
      {name === "sms" && (
        <>
          <Path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" {...p} />
          <Path d="M6.5 9h.01M10 9h.01M13.5 9h.01" {...p} strokeWidth={2.2} />
        </>
      )}
      {name === "whatsapp" && (
        <>
          <Path d="M3.5 16.5l1-3.4A6.8 6.8 0 1 1 7 15.6z" {...p} />
          <Path d="M8 7.2c0 2.5 2.2 4.7 4.7 4.8l.9-1.1-1.4-.7-.6.6a3.4 3.4 0 0 1-1.7-1.7l.6-.6-.6-1.4z" {...p} strokeWidth={1.2} />
        </>
      )}
      {name === "play" && <Path d="M6.5 4.5v11l9-5.5z" {...p} />}
      {name === "dialpad" && (
        <>
          {[5, 10, 15].flatMap((x) => [4, 8.5, 13].map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={color} />))}
          <Circle cx={10} cy={17.3} r={1.1} fill={color} />
        </>
      )}
      {name === "sim" && (
        <>
          <Path d="M6 2.8h6l3.5 3.5V16a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 16V4A1.2 1.2 0 0 1 6 2.8z" {...p} />
          <Path d="M7.5 9.5h5v5h-5zM10 9.5v5M7.5 12h5" {...p} strokeWidth={1.2} />
        </>
      )}
      {name === "folder" && <Path d="M3 6a1 1 0 0 1 1-1h4l1.5 1.8H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" {...p} />}
      {name === "help" && (
        <>
          <Circle cx={10} cy={10} r={7} {...p} />
          <Path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4M10 14h.01" {...p} />
        </>
      )}
      {name === "wrench" && (
        <Path d="M12.5 3.5a3.8 3.8 0 0 0-3.6 5L3.7 13.7a1.6 1.6 0 0 0 2.3 2.3l5.2-5.2a3.8 3.8 0 0 0 5-3.6l-2.2 2.2-2.4-.6-.6-2.4z" {...p} />
      )}
      {name === "trash" && <Path d="M4 5.5h12M8 5.5V4h4v1.5M5.5 5.5l.8 10.5a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10.5M8.5 8.5v5M11.5 8.5v5" {...p} />}
      {name === "close" && <Path d="M5 5l10 10M15 5 5 15" {...p} />}
      {name === "clock" && (
        <>
          <Circle cx={10} cy={10} r={7} {...p} />
          <Path d="M10 6v4l2.5 1.5" {...p} />
        </>
      )}
      {name === "calendar" && (
        <>
          <Path d="M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 9h14M7 3v3.5M13 3v3.5" {...p} />
        </>
      )}
      {name === "alert" && (
        <>
          <Circle cx={10} cy={10} r={7} {...p} />
          <Path d="M10 6.2v4.6M10 13.6h.01" {...p} strokeWidth={2} />
        </>
      )}
      {name === "backspace" && <Path d="M7 4.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7l-4.5-5.5zM9.5 8l4 4M13.5 8l-4 4" {...p} />}
      {name === "rocket" && (
        <>
          <Path d="M11.5 3.5c2.5 0 5 2.5 5 5-1.5 3-4.5 5.5-7.5 6.5L5 10.5c1-3 3.5-6 6.5-7z" {...p} />
          <Circle cx={12} cy={8} r={1.4} {...p} />
          <Path d="M6.5 13.5 4 16M5 10.5 3 11l1.5 1.5M9.5 15l-.5 2 -1.5-1.5" {...p} />
        </>
      )}
      {name === "chevron" && <Path d="M8 5l5 5-5 5" {...p} />}
      {name === "bolt" && <Path d="M11 2.5 4.5 11h5L9 17.5 15.5 9h-5z" {...p} />}
    </Svg>
  );
}
