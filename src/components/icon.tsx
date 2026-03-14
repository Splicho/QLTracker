import { Icon, type IconProps } from "@iconify/react";
import type { SVGProps } from "react";

export function ServerStack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}>
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
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" {...props}><path fill="currentColor" d="M428.4 27.8v456.4h60.9V27.8zM327 168.2v316h60.8v-316zM225.4 273.6v210.6h61V273.6zM124 343.8v140.4h60.9V343.8zM22.67 394.9v89.3h60.84v-89.3z"></path></svg>);
}

export function Spinner(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity={0.25}></path><path fill="currentColor" d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"><animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"></animateTransform></path></svg>);
}

export function Play(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M21.409 9.353a2.998 2.998 0 0 1 0 5.294L8.597 21.614C6.534 22.737 4 21.277 4 18.968V5.033c0-2.31 2.534-3.769 4.597-2.648z"></path></svg>);
}

export function Star(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m13.728 3.444l1.76 3.549c.24.494.88.968 1.42 1.058l3.189.535c2.04.343 2.52 1.835 1.05 3.307l-2.48 2.5c-.42.423-.65 1.24-.52 1.825l.71 3.095c.56 2.45-.73 3.397-2.88 2.117l-2.99-1.785c-.54-.322-1.43-.322-1.98 0L8.019 21.43c-2.14 1.28-3.44.322-2.88-2.117l.71-3.095c.13-.585-.1-1.402-.52-1.825l-2.48-2.5C1.39 10.42 1.86 8.929 3.899 8.586l3.19-.535c.53-.09 1.17-.564 1.41-1.058l1.76-3.549c.96-1.925 2.52-1.925 3.47 0"></path></svg>);
}

export function Plus(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"></path></svg>);
}

export function Edit(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.782 16.31L3 21l4.69-.782a3.96 3.96 0 0 0 2.151-1.106L20.42 8.532a1.98 1.98 0 0 0 0-2.8L18.269 3.58a1.98 1.98 0 0 0-2.802 0L4.888 14.16a3.96 3.96 0 0 0-1.106 2.15M14 6l4 4"></path></svg>);
}

export function SlashCircle(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><g fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M13.294 7.17L12 12l-1.294 4.83"></path><circle cx={12} cy={12} r={10}></circle></g></svg>);
}

export function Medal(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 20" {...props}><path fill="currentColor" d="M13.867 2a2.5 2.5 0 0 1 2.145 1.214l.632 1.054c.233.388.356.833.356 1.286v.09a2.5 2.5 0 0 1-.42 1.387l-3.21 4.815a4 4 0 1 1-6.74.001L3.42 7.03A2.5 2.5 0 0 1 3 5.645v-.091a2.5 2.5 0 0 1 .356-1.286l.632-1.054A2.5 2.5 0 0 1 6.133 2zM10 11a3 3 0 1 0 0 6a3 3 0 0 0 0-6M5.002 3.517q-.086.097-.156.212l-.632 1.053A1.5 1.5 0 0 0 4 5.554v.09c0 .297.088.586.252.833L7.3 11.049a4 4 0 0 1 1.829-.953L5.245 4.27a1.46 1.46 0 0 1-.243-.753m9.995 0a1.46 1.46 0 0 1-.242.753l-3.886 5.826a4 4 0 0 1 1.83.952l3.049-4.571A1.5 1.5 0 0 0 16 5.645v-.091a1.5 1.5 0 0 0-.214-.772l-.632-1.053a1.5 1.5 0 0 0-.157-.212M10 9.599L12.4 6H7.6zM6.46 3a.46.46 0 0 0-.383.715l.86 1.29L7 5h6q.03 0 .062.006l.86-1.291A.461.461 0 0 0 13.54 3z"></path></svg>);
}

export function InfoCircle(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}><circle cx={12} cy={12} r={10} strokeWidth={1.5}></circle><path strokeWidth={1.5} d="M12 16v-4.5"></path><path strokeWidth={1.8} d="M12 8.012v-.01"></path></g></svg>);
}

export function ArrowUpRight(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" {...props}><path fill="currentColor" d="M10.586 4H4V2h10v10h-2V5.414l-8.293 8.293l-1.414-1.414z"></path></svg>);
}

export function Lock(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><g fill="none" stroke="currentColor" strokeWidth={1}><path strokeWidth={1.5} d="M4.268 18.845c.225 1.67 1.608 2.979 3.292 3.056c1.416.065 2.855.099 4.44.099s3.024-.034 4.44-.1c1.684-.076 3.067-1.385 3.292-3.055c.147-1.09.268-2.207.268-3.345s-.121-2.255-.268-3.345c-.225-1.67-1.608-2.979-3.292-3.056A95 95 0 0 0 12 9c-1.585 0-3.024.034-4.44.1c-1.684.076-3.067 1.385-3.292 3.055C4.12 13.245 4 14.362 4 15.5s.121 2.255.268 3.345Z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.996 15.5h.01"></path></g></svg>);
}

export function Unlock(props: SVGProps<SVGSVGElement>) {
	return (<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}><g fill="none" stroke="currentColor" strokeWidth={1}><path strokeWidth={1.5} d="M4.268 18.845c.225 1.67 1.608 2.979 3.292 3.056c1.416.065 2.855.099 4.44.099s3.024-.034 4.44-.1c1.684-.076 3.067-1.385 3.292-3.055c.147-1.09.268-2.207.268-3.345s-.121-2.255-.268-3.345c-.225-1.67-1.608-2.979-3.292-3.056A95 95 0 0 0 12 9c-1.585 0-3.024.034-4.44.1c-1.684.076-3.067 1.385-3.292 3.055C4.12 13.245 4 14.362 4 15.5s.121 2.255.268 3.345Z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 9V6.5A4.5 4.5 0 0 1 12 2c1.96 0 3.5 1.5 4 3"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.996 15.5h.01"></path></g></svg>);
}
