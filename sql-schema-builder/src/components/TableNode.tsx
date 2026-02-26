import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Table, Column } from '../types';

interface TableNodeData extends Table {
  onEditTable?: (tableId: string) => void;
  onDeleteTable?: (tableId: string) => void;
  hasRelationships?: boolean;
}

const TableNode = ({ data, selected }: NodeProps<TableNodeData>) => {
  const getDataTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'TEXT': 'T',
      'INTEGER': '#',
      'LONG': 'L',
      'DOUBLE': 'D',
      'CURRENCY': '$',
      'DATETIME': '📅',
      'BOOLEAN': '☑',
      'AUTOINCREMENT': '↗',
      'MEMO': '¶',
      'OLE': '📎'
    };
    return icons[type] || '?';
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onEditTable) {
      data.onEditTable(data.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDeleteTable && confirm(`Удалить таблицу "${data.name}"?`)) {
      data.onDeleteTable(data.id);
    }
  };

  return (
    <div
      className={`table-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'white',
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: '8px',
        minWidth: '200px',
        boxShadow: selected ? '0 4px 12px rgba(25, 118, 210, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Header - click to edit */}
      <div
        onClick={handleHeaderClick}
        style={{
          padding: '10px 12px',
          background: '#1976d2',
          color: 'white',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="Кликните для редактирования таблицы"
      >
        <span style={{ fontSize: '14px' }}>{data.name}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Убрали кнопку редактирования - используйте двойной клик по таблице */}
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

      {/* Columns */}
      <div style={{ padding: '8px 0' }}>
        {data.columns.map((column: Column, index: number) => (
          <div
            key={column.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              fontSize: '13px',
              borderTop: index > 0 ? '1px solid #f0f0f0' : 'none',
              gap: '8px'
            }}
          >
            {/* Primary key indicator */}
            {column.primaryKey && (
              <span style={{ color: '#ff9800', fontWeight: 'bold' }}>🔑</span>
            )}
            {!column.primaryKey && <span style={{ width: '16px' }} />}
            
            {/* Column name */}
            <span style={{ flex: 1, color: column.primaryKey ? '#1976d2' : '#333' }}>
              {column.name}
            </span>
            
            {/* Data type */}
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                background: '#f5f5f5',
                borderRadius: '4px',
                color: '#666'
              }}
            >
              {column.type}
            </span>
            
            {/* Handle for connections */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${column.id}-source`}
              style={{
                width: '10px',
                height: '10px',
                background: column.primaryKey ? '#ff9800' : '#1976d2',
                border: '2px solid white'
              }}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={`${column.id}-target`}
              style={{
                width: '10px',
                height: '10px',
                background: column.primaryKey ? '#ff9800' : '#1976d2',
                border: '2px solid white'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(TableNode);
