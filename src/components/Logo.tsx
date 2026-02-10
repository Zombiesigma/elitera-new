import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Logo({ className, style }: LogoProps) {
  return (
    <div 
      className={cn("relative overflow-hidden rounded-lg shrink-0 aspect-square", className)} 
      style={style}
    >
      <Image
        src="https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/uploads/1770617037724-WhatsApp_Image_2026-02-07_at_13.45.35.jpeg"
        alt="Elitera Logo"
        fill
        sizes="(max-width: 768px) 40px, 60px"
        className="object-cover"
        priority
      />
    </div>
  );
}
