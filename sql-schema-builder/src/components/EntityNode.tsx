import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Entity, Attribute, AttributeType } from '../types';

interface EntityNodeData extends Entity {
  onEditEntity?: (entityId: string) => void;
  onDeleteEntity?: (entityId: string) => void;
  notation?: 'CHEN' | 'CROWS_FOOT' | 'IDEF1X';
}

const EntityNode = ({ data, selected }: NodeProps<EntityNodeData>) => {
  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onEditEntity) {
      data.onEditEntity(data.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDeleteEntity && confirm(`Удалить сущность "${data.name}"?`)) {
      data.onDeleteEntity(data.id);
    }
  };

  const getAttributeIcon = (type: AttributeType) => {
    switch (type) {
      case 'PRIMARY':
        return '🔑';
      case 'MULTIVALUED':
        return '📚';
      case 'DERIVED':
        return '📐';
      default:
        return '';
    }
  };

  const isChenNotation = data.notation === 'CHEN';

  return (
    <div
      className={`entity-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'white',
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: isChenNotation ? '12px' : '8px',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(25, 118, 210, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        onClick={handleHeaderClick}
        style={{
          padding: isChenNotation ? '12px' : '10px 12px',
          background: isChenNotation ? '#4a90e2' : '#1976d2',
          color: 'white',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="Кликните для редактирования"
      >
        <span style={{ fontSize: '14px' }}>{data.name}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleDeleteClick}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 6px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '12px'
            }}
            title="Удалить"
          >
            ×
          </button>
        </div>
      </div>

      {/* Attributes */}
      <div style={{ padding: isChenNotation ? '10px' : '8px 0' }}>
        {data.attributes.map((attr: Attribute, index: number) => (
          <div
            key={attr.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              fontSize: '13px',
              borderTop: index > 0 ? '1px solid #f0f0f0' : 'none',
              gap: '8px',
              color: attr.type === 'PRIMARY' ? '#1976d2' : '#333',
              fontWeight: attr.type === 'PRIMARY' ? '600' : '400'
            }}
          >
            {/* Attribute type icon */}
            <span>{getAttributeIcon(attr.type)}</span>
            
            {/* Attribute name */}
            <span style={{ flex: 1 }}>{attr.name}</span>
            
            {/* Handles for connections */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${attr.id}-source`}
              style={{
                width: '10px',
                height: '10px',
                background: attr.type === 'PRIMARY' ? '#ff9800' : '#1976d2',
                border: '2px solid white'
              }}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={`${attr.id}-target`}
              style={{
                width: '10px',
                height: '10px',
                background: attr.type === 'PRIMARY' ? '#ff9800' : '#1976d2',
                border: '2px solid white'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(EntityNode);