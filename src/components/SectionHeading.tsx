import React from 'react';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  actions?: React.ReactNode;
}

const SectionHeading = ({ title, subtitle, align = 'left', actions }: SectionHeadingProps) => {
  return (
    <div className={`mb-12 ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <div className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} mb-4`}>
        <div className={`inline-block mb-2 h-1 w-12 bg-orange-500 ${align === 'center' ? 'mx-auto' : ''}`}></div>
        <h2 className={`text-3xl md:text-4xl font-bold heading-gradient-strong ${align === 'center' ? 'mb-2' : 'mb-1'}`}>
          {title}
        </h2>
        {actions && <div className="mt-2">{actions}</div>}
      </div>
      {subtitle && (
        <p className={`text-slate-400 text-lg max-w-2xl ${align === 'center' ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeading;
