import { Icon, type IconProps } from "@iconify/react";
import type { SVGProps } from "react";

export function ServerStack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M18 3H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 4.602 3 5.068 3 6s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 9 5.068 9 6 9h12c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 7.398 21 6.932 21 6s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 3 18.932 3 18 3m0 6H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 10.602 3 11.068 3 12s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 15 5.068 15 6 15h12c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 13.398 21 12.932 21 12s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 9 18.932 9 18 9m0 6H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 16.602 3 17.068 3 18s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 21 5.068 21 6 21h12c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 19.398 21 18.932 21 18s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 15 18.932 15 18 15M6 6h.01M6 12h.01M6 18h.01M9 6h.01M9 12h.01M9 18h.01"
      />
    </svg>
  );
}

type RegionIconProps = Omit<IconProps, "icon">;

function RegionIcon(props: RegionIconProps & { icon: string }) {
  const { icon, ...rest } = props;
  return <Icon icon={icon} {...rest} />;
}

export function RegionAll(props: RegionIconProps) {
  return <RegionIcon icon="flat-color-icons:globe" {...props} />;
}

export function RegionEurope(props: RegionIconProps) {
  return <RegionIcon icon="circle-flags:eu" {...props} />;
}

export function RegionNorthAmerica(props: RegionIconProps) {
  return <RegionIcon icon="circle-flags:us" {...props} />;
}

export function RegionSouthAmerica(props: RegionIconProps) {
  return <RegionIcon icon="circle-flags:br" {...props} />;
}

export function RegionSouthAfrica(props: RegionIconProps) {
  return <RegionIcon icon="circle-flags:za" {...props} />;
}

export function RegionApac(props: RegionIconProps) {
  return <RegionIcon icon="circle-flags:jp" {...props} />;
}

export function Ping(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 512 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M428.4 27.8v456.4h60.9V27.8zM327 168.2v316h60.8v-316zM225.4 273.6v210.6h61V273.6zM124 343.8v140.4h60.9V343.8zM22.67 394.9v89.3h60.84v-89.3z"
      ></path>
    </svg>
  );
}

export function Spinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
        opacity={0.25}
      ></path>
      <path
        fill="currentColor"
        d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
      >
        <animateTransform
          attributeName="transform"
          dur="0.75s"
          repeatCount="indefinite"
          type="rotate"
          values="0 12 12;360 12 12"
        ></animateTransform>
      </path>
    </svg>
  );
}

export function Play(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M21.409 9.353a2.998 2.998 0 0 1 0 5.294L8.597 21.614C6.534 22.737 4 21.277 4 18.968V5.033c0-2.31 2.534-3.769 4.597-2.648z"
      ></path>
    </svg>
  );
}

export function Star(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="m13.728 3.444l1.76 3.549c.24.494.88.968 1.42 1.058l3.189.535c2.04.343 2.52 1.835 1.05 3.307l-2.48 2.5c-.42.423-.65 1.24-.52 1.825l.71 3.095c.56 2.45-.73 3.397-2.88 2.117l-2.99-1.785c-.54-.322-1.43-.322-1.98 0L8.019 21.43c-2.14 1.28-3.44.322-2.88-2.117l.71-3.095c.13-.585-.1-1.402-.52-1.825l-2.48-2.5C1.39 10.42 1.86 8.929 3.899 8.586l3.19-.535c.53-.09 1.17-.564 1.41-1.058l1.76-3.549c.96-1.925 2.52-1.925 3.47 0"
      ></path>
    </svg>
  );
}

export function Plus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4v16m8-8H4"
      ></path>
    </svg>
  );
}

export function Edit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3.782 16.31L3 21l4.69-.782a3.96 3.96 0 0 0 2.151-1.106L20.42 8.532a1.98 1.98 0 0 0 0-2.8L18.269 3.58a1.98 1.98 0 0 0-2.802 0L4.888 14.16a3.96 3.96 0 0 0-1.106 2.15M14 6l4 4"
      ></path>
    </svg>
  );
}

export function SlashCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" d="M13.294 7.17L12 12l-1.294 4.83"></path>
        <circle cx={12} cy={12} r={10}></circle>
      </g>
    </svg>
  );
}

export function Medal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 20 20"
      {...props}
    >
      <path
        fill="currentColor"
        d="M13.867 2a2.5 2.5 0 0 1 2.145 1.214l.632 1.054c.233.388.356.833.356 1.286v.09a2.5 2.5 0 0 1-.42 1.387l-3.21 4.815a4 4 0 1 1-6.74.001L3.42 7.03A2.5 2.5 0 0 1 3 5.645v-.091a2.5 2.5 0 0 1 .356-1.286l.632-1.054A2.5 2.5 0 0 1 6.133 2zM10 11a3 3 0 1 0 0 6a3 3 0 0 0 0-6M5.002 3.517q-.086.097-.156.212l-.632 1.053A1.5 1.5 0 0 0 4 5.554v.09c0 .297.088.586.252.833L7.3 11.049a4 4 0 0 1 1.829-.953L5.245 4.27a1.46 1.46 0 0 1-.243-.753m9.995 0a1.46 1.46 0 0 1-.242.753l-3.886 5.826a4 4 0 0 1 1.83.952l3.049-4.571A1.5 1.5 0 0 0 16 5.645v-.091a1.5 1.5 0 0 0-.214-.772l-.632-1.053a1.5 1.5 0 0 0-.157-.212M10 9.599L12.4 6H7.6zM6.46 3a.46.46 0 0 0-.383.715l.86 1.29L7 5h6q.03 0 .062.006l.86-1.291A.461.461 0 0 0 13.54 3z"
      ></path>
    </svg>
  );
}

export function InfoCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
      >
        <circle cx={12} cy={12} r={10} strokeWidth={1.5}></circle>
        <path strokeWidth={1.5} d="M12 16v-4.5"></path>
        <path strokeWidth={1.8} d="M12 8.012v-.01"></path>
      </g>
    </svg>
  );
}

export function ArrowUpRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      {...props}
    >
      <path
        fill="currentColor"
        d="M10.586 4H4V2h10v10h-2V5.414l-8.293 8.293l-1.414-1.414z"
      ></path>
    </svg>
  );
}

export function Lock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1}>
        <path
          strokeWidth={1.5}
          d="M4.268 18.845c.225 1.67 1.608 2.979 3.292 3.056c1.416.065 2.855.099 4.44.099s3.024-.034 4.44-.1c1.684-.076 3.067-1.385 3.292-3.055c.147-1.09.268-2.207.268-3.345s-.121-2.255-.268-3.345c-.225-1.67-1.608-2.979-3.292-3.056A95 95 0 0 0 12 9c-1.585 0-3.024.034-4.44.1c-1.684.076-3.067 1.385-3.292 3.055C4.12 13.245 4 14.362 4 15.5s.121 2.255.268 3.345Z"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.996 15.5h.01"
        ></path>
      </g>
    </svg>
  );
}

export function Unlock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1}>
        <path
          strokeWidth={1.5}
          d="M4.268 18.845c.225 1.67 1.608 2.979 3.292 3.056c1.416.065 2.855.099 4.44.099s3.024-.034 4.44-.1c1.684-.076 3.067-1.385 3.292-3.055c.147-1.09.268-2.207.268-3.345s-.121-2.255-.268-3.345c-.225-1.67-1.608-2.979-3.292-3.056A95 95 0 0 0 12 9c-1.585 0-3.024.034-4.44.1c-1.684.076-3.067 1.385-3.292 3.055C4.12 13.245 4 14.362 4 15.5s.121 2.255.268 3.345Z"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7.5 9V6.5A4.5 4.5 0 0 1 12 2c1.96 0 3.5 1.5 4 3"
        ></path>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.996 15.5h.01"
        ></path>
      </g>
    </svg>
  );
}

export function YouTube(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="m10 15l5.19-3L10 9zm11.56-7.83c.13.47.22 1.1.28 1.9c.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83c-.25.9-.83 1.48-1.73 1.73c-.47.13-1.33.22-2.65.28c-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44c-.9-.25-1.48-.83-1.73-1.73c-.13-.47-.22-1.1-.28-1.9c-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83c.25-.9.83-1.48 1.73-1.73c.47-.13 1.33-.22 2.65-.28c1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44c.9.25 1.48.83 1.73 1.73"
      ></path>
    </svg>
  );
}

export function Discord(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02M8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12m6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12"
      ></path>
    </svg>
  );
}

export function Steam(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10a10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77s-3.78 1.69-3.78 3.77v.05l-2.37 3.46l-.16-.01c-.59 0-1.14.18-1.59.49L2 11.2C2.43 6.05 6.73 2 12 2M8.28 17.17c.8.33 1.72-.04 2.05-.84s-.05-1.71-.83-2.04l-1.28-.53c.49-.18 1.04-.19 1.56.03c.53.21.94.62 1.15 1.15c.22.52.22 1.1 0 1.62c-.43 1.08-1.7 1.6-2.78 1.15c-.5-.21-.88-.59-1.09-1.04zm9.52-7.75c0 1.39-1.13 2.52-2.52 2.52a2.52 2.52 0 0 1-2.51-2.52a2.5 2.5 0 0 1 2.51-2.51a2.52 2.52 0 0 1 2.52 2.51m-4.4 0c0 1.04.84 1.89 1.89 1.89c1.04 0 1.88-.85 1.88-1.89s-.84-1.89-1.88-1.89c-1.05 0-1.89.85-1.89 1.89"
      ></path>
    </svg>
  );
}

export function Github(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
      ></path>
    </svg>
  );
}

export function XSocial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584l-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zm-1.291 19.492h2.039L6.486 3.24H4.298z"
      ></path>
    </svg>
  );
}

export function HeartOutline(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="m8.962 18.91l.464-.588zM12 5.5l-.54.52a.75.75 0 0 0 1.08 0zm3.038 13.41l.465.59zm-5.612-.588C7.91 17.127 6.253 15.96 4.938 14.48C3.65 13.028 2.75 11.335 2.75 9.137h-1.5c0 2.666 1.11 4.7 2.567 6.339c1.43 1.61 3.254 2.9 4.68 4.024zM2.75 9.137c0-2.15 1.215-3.954 2.874-4.713c1.612-.737 3.778-.541 5.836 1.597l1.08-1.04C10.1 2.444 7.264 2.025 5 3.06C2.786 4.073 1.25 6.425 1.25 9.137zM8.497 19.5c.513.404 1.063.834 1.62 1.16s1.193.59 1.883.59v-1.5c-.31 0-.674-.12-1.126-.385c-.453-.264-.922-.628-1.448-1.043zm7.006 0c1.426-1.125 3.25-2.413 4.68-4.024c1.457-1.64 2.567-3.673 2.567-6.339h-1.5c0 2.198-.9 3.891-2.188 5.343c-1.315 1.48-2.972 2.647-4.488 3.842zM22.75 9.137c0-2.712-1.535-5.064-3.75-6.077c-2.264-1.035-5.098-.616-7.54 1.92l1.08 1.04c2.058-2.137 4.224-2.333 5.836-1.596c1.659.759 2.874 2.562 2.874 4.713zm-8.176 9.185c-.526.415-.995.779-1.448 1.043s-.816.385-1.126.385v1.5c.69 0 1.326-.265 1.883-.59c.558-.326 1.107-.756 1.62-1.16z"
      ></path>
    </svg>
  );
}

export function HeartFilled(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M2 9.137C2 14 6.02 16.591 8.962 18.911C10 19.729 11 20.5 12 20.5s2-.77 3.038-1.59C17.981 16.592 22 14 22 9.138S16.5.825 12 5.501C7.5.825 2 4.274 2 9.137"
      ></path>
    </svg>
  );
}

export function HeartCrossed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 5.5C7.5.826 2 4.275 2 9.138s4.02 7.454 6.962 9.774C10 19.729 11 20.5 12 20.5m0-15C16.5.826 22 4.275 22 9.138s-4.02 7.454-6.962 9.774C14 19.729 13 20.5 12 20.5m0-15l-1.5 3L14 11l-3 3.5l2 2l-1 4"
      ></path>
    </svg>
  );
}

export function Bell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.5 18a3.5 3.5 0 1 1-7 0m10.731 0H4.77a1.769 1.769 0 0 1-1.25-3.02l.602-.603A3 3 0 0 0 5 12.256V9.5a7 7 0 0 1 14 0v2.756a3 3 0 0 0 .879 2.121l.603.603a1.77 1.77 0 0 1-1.25 3.02"
      ></path>
    </svg>
  );
}

export function GameController(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1}><path strokeLinejoin="round" strokeWidth={1.5} d="M2.008 15.81c.223-3.494.88-6.05 1.435-7.535c.281-.75.885-1.308 1.658-1.495c4.3-1.04 9.498-1.04 13.798 0c.773.187 1.377.745 1.658 1.495c.556 1.485 1.212 4.041 1.435 7.534c.133 2.09-1.377 3.241-3.05 4.083c-1.064.537-1.883-1.046-2.427-2.272a1.82 1.82 0 0 0-1.687-1.084H9.172c-.739 0-1.39.415-1.687 1.084c-.544 1.226-1.363 2.809-2.428 2.272c-1.655-.833-3.183-1.976-3.049-4.083M5 4.5L6.963 4M19 4.5L17 4"></path><path strokeWidth={1.5} d="m9 13l-1.5-1.5m0 0L6 10m1.5 1.5L6 13m1.5-1.5L9 10"></path><path strokeLinejoin="round" strokeWidth={2} d="M15.988 10h.01m1.99 3h.01"></path></g></svg>);
}

export function Change(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.977 19.5A9 9 0 0 0 10 3.223M16.977 19.5V16m0 3.5H20.5M7 4.516a9 9 0 0 0 7 16.261M7 4.516V8m0-3.484H3.5"></path></svg>);
}

export function Cog(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          d="m21.318 7.141l-.494-.856c-.373-.648-.56-.972-.878-1.101c-.317-.13-.676-.027-1.395.176l-1.22.344c-.459.106-.94.046-1.358-.17l-.337-.194a2 2 0 0 1-.788-.967l-.334-.998c-.22-.66-.33-.99-.591-1.178c-.261-.19-.609-.19-1.303-.19h-1.115c-.694 0-1.041 0-1.303.19c-.261.188-.37.518-.59 1.178l-.334.998a2 2 0 0 1-.789.967l-.337.195c-.418.215-.9.275-1.358.17l-1.22-.345c-.719-.203-1.078-.305-1.395-.176c-.318.129-.505.453-.878 1.1l-.493.857c-.35.608-.525.911-.491 1.234c.034.324.268.584.736 1.105l1.031 1.153c.252.319.431.875.431 1.375s-.179 1.056-.43 1.375l-1.032 1.152c-.468.521-.702.782-.736 1.105s.14.627.49 1.234l.494.857c.373.647.56.971.878 1.1s.676.028 1.395-.176l1.22-.344a2 2 0 0 1 1.359.17l.336.194c.36.23.636.57.788.968l.334.997c.22.66.33.99.591 1.18c.262.188.609.188 1.303.188h1.115c.694 0 1.042 0 1.303-.189s.371-.519.59-1.179l.335-.997c.152-.399.428-.738.788-.968l.336-.194c.42-.215.9-.276 1.36-.17l1.22.344c.718.204 1.077.306 1.394.177c.318-.13.505-.454.878-1.101l.493-.857c.35-.607.525-.91.491-1.234s-.268-.584-.736-1.105l-1.031-1.152c-.252-.32-.431-.875-.431-1.375s.179-1.056.43-1.375l1.032-1.153c.468-.52.702-.781.736-1.105s-.14-.626-.49-1.234Z"
        ></path>
        <path d="M15.52 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0Z"></path>
      </g>
    </svg>
  );
}

export function Eye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" d="M2 8s4.477-5 10-5s10 5 10 5"></path>
        <path d="M21.544 13.045c.304.426.456.64.456.955c0 .316-.152.529-.456.955C20.178 16.871 16.689 21 12 21c-4.69 0-8.178-4.13-9.544-6.045C2.152 14.529 2 14.315 2 14c0-.316.152-.529.456-.955C3.822 11.129 7.311 7 12 7c4.69 0 8.178 4.13 9.544 6.045Z"></path>
        <path d="M15 14a3 3 0 1 0-6 0a3 3 0 0 0 6 0Z"></path>
      </g>
    </svg>
  );
}
