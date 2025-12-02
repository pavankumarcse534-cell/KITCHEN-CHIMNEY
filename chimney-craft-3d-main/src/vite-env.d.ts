/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        "auto-rotate"?: boolean;
        "camera-controls"?: boolean;
        loading?: string;
        reveal?: string;
        "shadow-intensity"?: string;
        "environment-image"?: string;
        exposure?: string;
        "tone-mapping"?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "interaction-policy"?: string;
        ref?: React.Ref<any>;
      },
      HTMLElement
    >;
  }
}
