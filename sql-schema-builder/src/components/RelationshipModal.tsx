import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { Relationship } from '../types';

interface RelationshipModalProps {
  show: boolean;
  relationship: Relationship | null;
  sourceTableName: string;
  targetTableName: string;
  onSave: (relationship: Relationship) => void;
  onDelete: (relationshipId: string) => void;
  onClose: () => void;
}

const RelationshipModal: React.FC<RelationshipModalProps> = ({
  show,
  relationship,
  sourceTableName,
  targetTableName,
  onSave,
  onDelete,
  onClose
}) => {
  const [cardinality, setCardinality] = React.useState<'1:1' | '1:N' | 'N:1' | 'N:M'>('1:N');
  const [sourceOptional, setSourceOptional] = React.useState(false);
  const [targetOptional, setTargetOptional] = React.useState(false);
  const [onDeleteAction, setOnDeleteAction] = React.useState<'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'>('CASCADE');
  const [onUpdateAction, setOnUpdateAction] = React.useState<'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'>('CASCADE');

  React.useEffect(() => {
    if (relationship) {
      setCardinality(relationship.cardinality);
      setSourceOptional(relationship.sourceOptional);
      setTargetOptional(relationship.targetOptional);
      setOnDeleteAction(relationship.onDelete);
      setOnUpdateAction(relationship.onUpdate);
    } else {
      setCardinality('1:N');
      setSourceOptional(false);
      setTargetOptional(false);
      setOnDeleteAction('CASCADE');
      setOnUpdateAction('CASCADE');
    }
  }, [relationship, show]);

  const handleSave = () => {
    if (!relationship) return;

    const updated: Relationship = {
      ...relationship,
      cardinality,
      sourceOptional,
      targetOptional,
      onDelete: onDeleteAction,
      onUpdate: onUpdateAction
    };

    onSave(updated);
  };

  const getCardinalityLabel = () => {
    const sourceLabel = sourceOptional ? '0..' : '';
    const targetLabel = targetOptional ? '0..' : '';

    switch (cardinality) {
      case '1:1':
        return `${sourceLabel}1 : ${targetLabel}1`;
      case '1:N':
        return `${sourceLabel}1 : ${targetLabel}N`;
      case 'N:1':
        return `${sourceLabel}N : ${targetLabel}1`;
      case 'N:M':
        return `${sourceLabel}N : ${targetLabel}M`;
      default:
        return '1:N';
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Настройка связи</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 p-3 bg-light rounded">
          <strong>{sourceTableName}</strong>
          <span className="mx-2">→</span>
          <strong>{targetTableName}</strong>
          <div className="mt-2 text-muted small">
            Текущая мощность: <strong>{getCardinalityLabel()}</strong>
          </div>
        </div>

        <Form.Group className="mb-3">
          <Form.Label>Мощность связи</Form.Label>
          <Form.Select
            value={cardinality}
            onChange={(e) => setCardinality(e.target.value as any)}
          >
            <option value="1:1">Один к одному (1:1)</option>
            <option value="1:N">Один ко многим (1:N)</option>
            <option value="N:1">Многие к одному (N:1)</option>
            <option value="N:M">Многие ко многим (N:M)</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Обязательность</Form.Label>
          <div className="d-flex gap-3">
            <Form.Check
              type="checkbox"
              label={`${sourceTableName} может быть пустым`}
              checked={sourceOptional}
              onChange={(e) => setSourceOptional(e.target.checked)}
            />
            <Form.Check
              type="checkbox"
              label={`${targetTableName} может быть пустым`}
              checked={targetOptional}
              onChange={(e) => setTargetOptional(e.target.checked)}
            />
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>ON DELETE</Form.Label>
          <Form.Select
            value={onDeleteAction}
            onChange={(e) => setOnDeleteAction(e.target.value as any)}
          >
            <option value="CASCADE">CASCADE (удалить связанные)</option>
            <option value="SET NULL">SET NULL (установить NULL)</option>
            <option value="RESTRICT">RESTRICT (запретить)</option>
            <option value="NO ACTION">NO ACTION</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>ON UPDATE</Form.Label>
          <Form.Select
            value={onUpdateAction}
            onChange={(e) => setOnUpdateAction(e.target.value as any)}
          >
            <option value="CASCADE">CASCADE (обновить связанные)</option>
            <option value="SET NULL">SET NULL (установить NULL)</option>
            <option value="RESTRICT">RESTRICT (запретить)</option>
            <option value="NO ACTION">NO ACTION</option>
          </Form.Select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        {relationship && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Удалить связь?')) {
                onDelete(relationship.id);
              }
            }}
            className="me-auto"
          >
            Удалить связь
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RelationshipModal;
