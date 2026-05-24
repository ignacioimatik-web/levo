import React from 'react';

const TopoBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className="scale-150"
      >
        <defs>
          <pattern
            id="topo"
            width="400"
            height="400"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 200 Q 100 100, 200 200 T 400 200"
              stroke="white"
              strokeWidth="0.5"
              fill="none"
            />
            <path
              d="M0 100 Q 150 250, 300 100 T 400 150"
              stroke="white"
              strokeWidth="0.5"
              fill="none"
            />
            <path
              d="M0 300 Q 100 200, 250 300 T 400 250"
              stroke="white"
              strokeWidth="0.5"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topo)" />
      </svg>
    </div>
  );
};

export default TopoBackground;
