import React from 'react';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}

const SectionHeading = ({ title, subtitle, align = 'left' }: SectionHeadingProps) => {
  return (
    <div className={`mb-12 ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <div className={`inline-block mb-2 h-1 w-12 bg-orange-500 ${align === 'center' ? 'mx-auto' : ''}`}></div>
      <h2 className={`text-3xl md:text-4xl font-bold heading-gradient-strong ${align === 'center' ? 'mb-4' : 'mb-2'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">{subtitle}</p>
      )}
    </div>
  );
};

export default SectionHeading;
