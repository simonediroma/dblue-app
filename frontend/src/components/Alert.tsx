import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AlertProps {
  icon?: LucideIcon;
  title?: string;
  description: React.ReactNode;
  className?: string;
  iconClassName?: string;
  iconContainerClassName?: string;
}

export const Alert = ({ 
  icon: Icon, 
  title, 
  description, 
  className = "", 
  iconClassName = "",
  iconContainerClassName = ""
}: AlertProps) => {
  return (
    <div className={`bg-warning-bg border border-warning-stroke p-4 rounded-2xl flex gap-4 ${className}`}>
      {Icon && (
        <div className={`shrink-0 p-2 bg-on-surface 5 rounded-xl flex items-center justify-center h-fit ${iconContainerClassName}`}>
          <Icon className={`w-5 h-5 text-warning-text ${iconClassName}`}/>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {title && (
          <h4 className="font-sans text-sm font-bold text-warning-text leading-tight">
            {title}
          </h4>
        )}
        <div className="font-sans text-xs font-medium text-warning-secondary leading-tight">
          {description}
        </div>
      </div>
    </div>
  );
};
