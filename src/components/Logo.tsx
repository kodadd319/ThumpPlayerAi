import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({ className, style }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div 
        className={`flex items-center justify-center font-mono font-black tracking-widest text-[#3adbff] uppercase ${className || ''}`}
        style={{
          fontSize: '1.25rem',
          textShadow: '0 0 10px rgba(58, 219, 255, 0.6), 0 0 20px rgba(58, 219, 255, 0.3)',
          ...style
        }}
        id="text-logo-placeholder"
      >
        ThumpPlayer<span className="text-white">.ai</span>
      </div>
    );
  }

  return (
    <img
      src="/logo.png?v=3"
      alt="thumplayer.ai Logo"
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
      id="img-logo-element"
    />
  );
};

export default Logo;
