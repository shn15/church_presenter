import React, { useState } from 'react';
// @ts-ignore
import logoUrl from '../assets/images/Logo_2.jpeg';

export const AppLogo = ({ 
  className = "w-10 h-10", 
  bgWhiteSquare = false 
}: { 
  className?: string; 
  showText?: boolean; 
  bgWhiteSquare?: boolean; 
}) => {
  const [src, setSrc] = useState<string>(logoUrl || "/logo.jpeg");

  const content = (
    <img
      src={src}
      alt="Church Presenter Logo"
      onError={() => {
        if (src !== "/logo.jpeg") {
          setSrc("/logo.jpeg");
        }
      }}
      className="w-full h-full object-contain rounded-lg"
      referrerPolicy="no-referrer"
    />
  );

  if (bgWhiteSquare) {
    return (
      <div className={`bg-white rounded-xl p-1 shadow-lg border border-[#2A2A2E]/60 flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {content}
    </div>
  );
};

