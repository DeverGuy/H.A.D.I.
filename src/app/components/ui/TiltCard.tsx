import React from 'react';
import Tilt from 'react-parallax-tilt';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

export function TiltCard({ children, className = '' }: TiltCardProps) {
  return (
    <Tilt
      tiltMaxAngleX={10}
      tiltMaxAngleY={10}
      perspective={1000}
      scale={1.02}
      transitionSpeed={1500}
      gyroscope={true}
      className={className}
    >
      {children}
    </Tilt>
  );
}
