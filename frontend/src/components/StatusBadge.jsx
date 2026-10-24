// Цветной бейдж статуса заказа.
import { STATUS_BY_CODE } from '../utils/statuses.js';

export default function StatusBadge({ status }) {
  const known = STATUS_BY_CODE[status?.code];
  return <span className={`badge badge-${known?.tone || 'gray'}`}>{status?.nameRu || known?.label || status?.code}</span>;
}