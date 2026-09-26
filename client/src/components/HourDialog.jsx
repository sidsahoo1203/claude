import Modal from './Modal';
import LogForm from './LogForm';
import BlockDetail from './BlockDetail';
import { formatDate, formatInstant, hourRange } from '../format';

// Decides what tapping an hour shows, based on the server-computed status.
export default function HourDialog({ hour, onClose, onChanged }) {
  const title = `${hourRange(hour.hour)}`;
  let body;
  if (hour.block) {
    body = <BlockDetail block={{ ...hour.block, date: hour.date, plan: hour.plan }} onChanged={onChanged} />;
  } else if (hour.status === 'open') {
    body = (
      <LogForm
        hour={hour}
        onCancel={onClose}
        onSaved={() => {
          onChanged();
          onClose();
        }}
      />
    );
  } else if (hour.status === 'unaccounted') {
    body = (
      <p>
        This hour was not logged within the window (closed {formatInstant(hour.logDeadline)}). It stays unaccounted
        permanently.
      </p>
    );
  } else {
    body = <p>This hour hasn't finished yet. You can log it once it ends at {formatInstant(hour.endsAt)}.</p>;
  }
  return (
    <Modal title={`${formatDate(hour.date, { year: undefined })} · ${title}`} onClose={onClose}>
      {body}
    </Modal>
  );
}
