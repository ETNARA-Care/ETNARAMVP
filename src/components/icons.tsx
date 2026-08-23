interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function makeIcon(path: string) {
  return function Icon({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  };
}

export const ShieldIcon = makeIcon(
  "M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z"
);
export const CheckIcon = makeIcon("M20 6 9 17l-5-5");
export const MapPinIcon = makeIcon(
  "M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
);
export const MealIcon = makeIcon(
  "M18 2v6a2 2 0 0 1-2 2h-1v10 M15 10V2 M12 2v20 M6 2v20 M6 12H2"
);
export const HydrationIcon = makeIcon(
  "M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"
);
export const ActivityIcon = makeIcon("M22 12h-4l-3 9L9 3l-3 9H2");
export const MoodIcon = makeIcon(
  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01"
);
export const CameraIcon = makeIcon(
  "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
);
export const BathIcon = makeIcon(
  "M9 6 6.5 3.5a1.5 1.5 0 0 0-2.6 1L4 6 M4 12h16 M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6 M8 21v1 M16 21v1"
);
export const NoteIcon = makeIcon(
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6"
);
export const AlertIcon = makeIcon(
  "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01"
);
export const ChevronRightIcon = makeIcon("m9 18 6-6-6-6");
export const ArrowLeftIcon = makeIcon("M19 12H5 M12 19l-7-7 7-7");
export const HomeIcon = makeIcon(
  "M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"
);
export const HistoryIcon = makeIcon(
  "M3 3v5h5 M3.05 13A9 9 0 1 0 6 5.3L3 8 M12 7v5l4 2"
);
export const MessageIcon = makeIcon(
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
);
export const UsersIcon = makeIcon(
  "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"
);
