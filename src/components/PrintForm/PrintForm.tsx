// src/components/PrintForm/PrintForm.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { getAllHunters } from '../../db';
import { generateBlankPdf, generateVoucherPdf } from './usePrint';
import { getConfig, type PrintConfig, setConfig } from '../../utils/config';
import { getCoordsForBlank, type BlankType } from '../../utils/coords';
import './PrintForm.scss';
import { configFields, type SavedGroup } from '../ConfigModal/ConfigModal';

interface ResourceGroup {
  resource: string;
  dateFrom: string;
  dateTo: string;
  dailyLimit: string;
  seasonLimit: string;
}

export interface PrintFormValues extends PrintConfig {
  resources: ResourceGroup[];
  issueDate: string;
  voucherNumber: string;
  specialMark: string;
  voucherPermissionNumber: string;
}

const MAX_RESOURCES = 10;
const DRAFT_KEY = 'print_form_draft';

const PrintForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hunter, setHunter] = useState<any>(null);

  const cfgRaw = useMemo(
    () => getConfig() as PrintConfig & { savedGroups?: SavedGroup[] },
    []
  );

  const savedGroups = cfgRaw.savedGroups || [];

  const [blankType, setBlankType] = useState<BlankType>(
    (savedGroups[0]?.blankType as BlankType) || 'Yellow'
  );

  const padVoucher = (n: number) => String(n).padStart(4, '0');

  const { register, control, handleSubmit, reset, setValue, getValues } =
    useForm<PrintFormValues>({
      defaultValues: {
        organizationName: cfgRaw.organizationName || '',
        huntingPlace: cfgRaw.huntingPlace || '',
        issuedByName: cfgRaw.issuedByName || '',
        huntType: (cfgRaw as any).huntType || '',
        jobTitle: cfgRaw.jobTitle || '',
        resources: [
          {
            resource: '',
            dateFrom: '',
            dateTo: '',
            dailyLimit: '',
            seasonLimit: '',
          },
        ],
        issueDate: new Date().toISOString().substring(0, 10),
        voucherNumber: cfgRaw.voucherNumber || '',
        specialMark: '',
        voucherPermissionNumber: '',
      },
    });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'resources',
  });

  const [groupInput, setGroupInput] = useState('');

  useEffect(() => {
    let mounted = true;

    const tryLoadDraft = (): Partial<PrintFormValues> | null => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
        return null;
      } catch {
        return null;
      }
    };

    const draft = tryLoadDraft();

    getAllHunters().then((list) => {
      if (!mounted) return;

      const h = list.find((x) => x.id === Number(id));
      if (!h) {
        navigate('/');
        return;
      }

      setHunter(h);

      const defaults: PrintFormValues = {
        organizationName: cfgRaw.organizationName || '',
        huntingPlace: cfgRaw.huntingPlace || '',
        issuedByName: cfgRaw.issuedByName || '',
        huntType: (cfgRaw as any).huntType || '',
        jobTitle: cfgRaw.jobTitle || '',
        resources: [
          {
            resource: '',
            dateFrom: '',
            dateTo: '',
            dailyLimit: '',
            seasonLimit: '',
          },
        ],
        issueDate: new Date().toISOString().substring(0, 10),
        voucherNumber: cfgRaw.voucherNumber || '',
        specialMark: '',
        voucherPermissionNumber: '',
      };

      const merged = { ...defaults, ...(draft || {}) } as PrintFormValues;

      // FIX: эти три поля ВСЕГДА берём из конфига
      merged.jobTitle = cfgRaw.jobTitle || '';
      merged.voucherNumber = cfgRaw.voucherNumber || '';

      reset({
        ...merged,
        jobTitle: cfgRaw.jobTitle || '',
        voucherNumber: cfgRaw.voucherNumber || '',
        voucherPermissionNumber: '',
        issueDate: new Date().toISOString().substring(0, 10),
      });

    });

    return () => {
      mounted = false;
    };
  }, [navigate, id, reset, cfgRaw]);

  const groupToResources = useCallback((g: SavedGroup): ResourceGroup[] => {
    const max = Math.min(g.animals.length, MAX_RESOURCES);
    return g.animals.slice(0, max).map((a) => ({
      resource: a,
      dateFrom: g.dateFrom,
      dateTo: g.dateTo,
      dailyLimit: g.dailyLimit || 'б/о',
      seasonLimit: g.seasonLimit || 'б/о',
    }));
  }, []);

  const applyGroup = (input: string) => {
    if (!input) return;

    const found = savedGroups.find(
      (g) => g.name.toLowerCase() === input.trim().toLowerCase()
    );

    let resourcesArr: ResourceGroup[] = [];

    if (found) {
      resourcesArr = groupToResources(found);
      const bt = (found.blankType as BlankType) || 'Yellow';
      setBlankType(bt);
    } else {
      const animals = input
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (animals.length === 0) {
        alert('Введите список животных или выберите группу.');
        return;
      }
      if (animals.length > MAX_RESOURCES) {
        if (
          !window.confirm(
            `Ввод содержит ${animals.length} животных, максимум ${MAX_RESOURCES}. Обрезать?`
          )
        )
          return;
      }

      const truncated = animals.slice(0, MAX_RESOURCES);
      const dateFrom = '2025-09-15';
      const dateTo = '2026-02-28';

      resourcesArr = truncated.map((a) => ({
        resource: a,
        dateFrom,
        dateTo,
        dailyLimit: 'б/о',
        seasonLimit: 'б/о',
      }));

      setBlankType('Yellow');
    }

    replace(resourcesArr);
    setValue('resources', resourcesArr);
  };

  const buildCoords = (data: PrintFormValues) => {
    const effective = (blankType as BlankType) || 'Yellow';
    return getCoordsForBlank(effective)(data);
  };

  const onSubmit = (data: PrintFormValues) => {
    if (!hunter) return;

    const coords = buildCoords(data);
    if (!coords) {
      alert('Ошибка: координаты не найдены.');
      return;
    }

    (async () => {
      try {
        const bytes = await generateBlankPdf(hunter, data, coords);
        if (!bytes) {
          alert('PDF пустой');
          return;
        }

        const blob = new Blob([new Uint8Array(bytes).buffer], {
          type: 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${hunter.fullName}_разрешение.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert('Ошибка генерации PDF');
      }
    })();
  };

  const onPrint = async (data: PrintFormValues) => {
    if (!hunter) return;

    const coords = buildCoords(data);
    if (!coords) {
      alert('Ошибка координат.');
      return;
    }

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-2000px',
      top: '0',
      width: '1px',
      height: '1px',
    });
    document.body.appendChild(iframe);

    try {
      const pdfBytes = await generateBlankPdf(hunter, data, coords);
      if (!pdfBytes) {
        alert('Ошибка: пустой PDF');
        return;
      }

      const blob = new Blob([Uint8Array.from(pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      iframe.src = url;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 300000);
    } catch (err) {
      console.error(err);
    }
  };

  const onPrintVoucher = async (data: PrintFormValues) => {
    if (!hunter) return;

    const r0 = (data.resources && data.resources[0]) || null;
    const voucherFrom = r0?.dateFrom || data.issueDate;
    const voucherTo = r0?.dateTo || data.issueDate;

    const rawNumber =
      data.voucherNumber?.trim() || cfgRaw.voucherNumber || '0001';

    const parsed = parseInt(rawNumber, 10);
    const startNum = Number.isFinite(parsed) ? parsed : 1;
    const usedVoucherNumber = padVoucher(startNum);

    const formForVoucher = {
      ...data,
      voucherFrom,
      voucherTo,
      voucherNumber: usedVoucherNumber,
    } as any;

    const coords = getCoordsForBlank('Voucher')(formForVoucher);
    if (!coords) {
      alert('Ошибка координат путёвки.');
      return;
    }

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-2000px',
      top: '0',
      width: '1px',
      height: '1px',
    });
    document.body.appendChild(iframe);

    try {
      const pdfBytes = await generateVoucherPdf(
        hunter,
        formForVoucher,
        coords
      );

      if (!pdfBytes) {
        alert('Пустой PDF');
        return;
      }

      // FIX: обновляем только конфиг, НЕ форму
      const cfg = getConfig();
      const nextNum = startNum + 1;
      const nextStr = padVoucher(nextNum);
      setConfig({ ...cfg, voucherNumber: nextStr });

      const blob = new Blob([Uint8Array.from(pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      iframe.src = url;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 300000);
    } catch (err) {
      console.error(err);
      alert('Ошибка печати путёвки');
    }
  };

  const handleChooseAnother = () => {
    try {
      const { jobTitle, voucherNumber, voucherPermissionNumber, issueDate, ...rest } = getValues();

      localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
    } catch (e) {
      console.warn('Не удалось сохранить черновик:', e);
    }
    navigate('/');
  };

  const handleAddResource = () => {
    if (fields.length >= MAX_RESOURCES) {
      alert(`Максимум ${MAX_RESOURCES}`);
      return;
    }
    append({
      resource: '',
      dateFrom: '',
      dateTo: '',
      dailyLimit: '',
      seasonLimit: '',
    });
  };

  if (!hunter) return <div className="print-form">Загрузка...</div>;

  return (
    <div className="print-form">
      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
        <button
          className="select-hunter-btn"
          type="button"
          onClick={handleChooseAnother}
        >
          ← Выбрать другого охотника
        </button>
      </div>

      <h1>Заполнение данных для печати</h1>

      <div className="hunter-info">
        <div className="hunter-top">
          <h2>Данные охотника</h2>
        </div>
        <div className="hunter-fields">
          <div>
            <strong>ФИО:</strong> {hunter.fullName}
          </div>
          <div>
            <strong>Охотничий билет:</strong> {hunter.series} №
            {hunter.number}
          </div>
          <div>
            <strong>Дата выдачи:</strong>{' '}
            {new Date(hunter.issueDate).toLocaleDateString()}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <h2>Параметры охоты</h2>

        <div className="config-fields">
          {configFields.map((f) => (
            <label key={String(f.key)}>
              {f.label}:
              <input {...register(f.key as any)} />
            </label>
          ))}
        </div>

        <div className="group-row">
          <input
            list="groups-datalist"
            placeholder="Выбрать или ввести группу"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            className="group-input"
          />
          <datalist id="groups-datalist">
            {savedGroups.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
          <button
            type="button"
            className="apply-group"
            onClick={() => applyGroup(groupInput)}
          >
            Применить
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="resource-group">
            <input
              {...register(`resources.${index}.resource` as const)}
              placeholder="Вид ресурса"
            />

            <div className="dates">
              <label>
                С:{' '}
                <input
                  type="date"
                  {...register(`resources.${index}.dateFrom` as const)}
                />
              </label>
              <label>
                По:{' '}
                <input
                  type="date"
                  {...register(`resources.${index}.dateTo` as const)}
                />
              </label>
            </div>

            <input
              {...register(`resources.${index}.dailyLimit` as const)}
              placeholder="Норма за день"
            />
            <input
              {...register(`resources.${index}.seasonLimit` as const)}
              placeholder="Норма за сезон"
            />

            {index > 0 && (
              <button
                type="button"
                className="remove"
                onClick={() => remove(index)}
              >
                Удалить
              </button>
            )}
          </div>
        ))}

        <button type="button" className="add" onClick={handleAddResource}>
          + Добавить ресурс
        </button>

        <div className="extra-fields">
          <label>
            Дата выдачи разрешения:
            <input type="date" {...register('issueDate')} />
          </label>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="print"
            onClick={handleSubmit(onPrint)}
          >
            Печать
          </button>
          <button type="submit" className="submit">
            Сформировать бланк
          </button>
        </div>

        <h3>Путёвка</h3>

        <div className="resource-group voucher-block">
          <label>
            Номер путёвки:
            <input type="text" {...register('voucherNumber')} />
          </label>

          <div className="dates">
            <label>
              С:{' '}
              <input type="date" {...register('resources.0.dateFrom' as const)} />
            </label>
            <label>
              По:{' '}
              <input type="date" {...register('resources.0.dateTo' as const)} />
            </label>
          </div>

          <label>
            Должность:
            <input type="text" {...register('jobTitle')} />
          </label>

          <label>
            Особая отметка:
            <input type="text" {...register('specialMark')} />
          </label>

          <label>
            Предоставление охоты по разрешению №:
            <input type="text" {...register('voucherPermissionNumber')} />
          </label>

          <div className="group-controls voucher-actions">
            <button
              type="button"
              className="print"
              onClick={handleSubmit(onPrintVoucher)}
            >
              Распечатать путёвку
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PrintForm;
