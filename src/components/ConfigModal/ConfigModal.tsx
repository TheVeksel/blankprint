import { useForm } from 'react-hook-form';
import './ConfigModal.scss';
import { getConfig, setConfig, type PrintConfig } from '../../utils/config';

interface ConfigModalProps {
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
  const { register, handleSubmit} = useForm<PrintConfig>({
    defaultValues: getConfig(),
  });

  const onSubmit = (data: PrintConfig) => {
    setConfig(data);
    onClose();
  };

  return (
    <div className="config-modal-backdrop" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="close-btn" onClick={onClose}>
          ×
        </div>
        <h2>Настройки печати</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="field">
            <label>Наименование организации:</label>
            <input {...register('organizationName')} />
          </div>
          <div className="field">
            <label>Место охоты:</label>
            <input {...register('huntingPlace')} />
          </div>
          <div className="field">
            <label>ФИО выдавшего:</label>
            <input {...register('issuedByName')} />
          </div>
          <div className="buttons">
            <button type="submit" className="save">Сохранить</button>
            <button type="button" className="cancel" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigModal;
