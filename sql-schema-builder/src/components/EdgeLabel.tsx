import React from 'react';

interface EdgeLabelProps {
  label: string;
  x: number;
  y: number;
  style?: React.CSSProperties;
}

const EdgeLabel: React.FC<EdgeLabelProps> = ({ label, x, y, style }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        background: 'white',
        border: '1px solid #1976d2',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#1976d2',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        ...style
      }}
    >
      {label}
    </div>
  );
};

export default EdgeLabel;
