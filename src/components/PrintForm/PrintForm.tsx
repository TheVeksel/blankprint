import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { getAllHunters } from '../../db';
import { generatePdf } from './usePrint';
import { getConfig, type PrintConfig } from '../../utils/config';
import './PrintForm.scss';

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
}

const PrintForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [hunter, setHunter] = React.useState<any>(null);

    const config = getConfig();

    const { register, control, handleSubmit, reset } = useForm<PrintFormValues>({
        defaultValues: {
            organizationName: config.organizationName || '',
            huntingPlace: config.huntingPlace || '',
            issuedByName: config.issuedByName || '',
            resources: [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
            issueDate: new Date().toISOString().split('T')[0],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'resources',
    });

    useEffect(() => {
        getAllHunters().then((list) => {
            const h = list.find((x) => x.id === Number(id));
            if (h) {
                setHunter(h);
                reset({
                    organizationName: config.organizationName || '',
                    huntingPlace: config.huntingPlace || '',
                    issuedByName: config.issuedByName || '',
                    resources: [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
                    issueDate: new Date().toISOString().split('T')[0],
                });
            } else {
                navigate('/');
            }
        });
    }, [navigate]);

    const coords = (data: PrintFormValues) => ({
        fullName: { x: 460, y: 95 },
        hunterTicketSeries: { x: 503, y: 115 },
        hunterTicketNumber: { x: 503, y: 165 },
        hunterIssueDate: { x: 524, yDay: 120, yMonth: 150, yYear: 255 },
        issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
        issuedBy: { x: 37, y: 245 },
        organizationName: { x: 52, y: 20 },
        huntingPlace: { x: 351, y: 70 },
        backIssueDate: { x: 68, yDay: 262, yMonth: 285, yYear: 393 },
        resources: data.resources.map((_, i) => ({
            resource: { x: 175 + i * 17, y: 40 },
            dateFrom: { x: 176 + i * 17, y: 143 },
            dateTo: { x: 176 + i * 17, y: 190 },
            dailyLimit: { x: 176 + i * 17, y: 250 },
            seasonLimit: { x: 176 + i * 17, y: 295 },
        })),
    });

    const onSubmit = (data: PrintFormValues) => {
        if (!hunter) return;

        generatePdf({ hunter, form: data, coords: coords(data) });
    };

    const onPrint = async (data: PrintFormValues) => {
  if (!hunter) return;

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-2000px',
    top: '0',
    width: '1px',
    height: '1px',
  });
  document.body.appendChild(iframe);

  // генерируем PDF и получаем Uint8Array
  const pdfBytes = await generatePdf({
    hunter,
    form: data,
    coords: coords(data),
    returnBytes: true,
  });
  if (!pdfBytes) { document.body.removeChild(iframe); return; }

  const bytes = Uint8Array.from(pdfBytes as any);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  iframe.src = url;

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };

  // автоматически убираем iframe и освобождаем Blob через 2 минуты
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
    console.log('DEBUG: iframe and Blob cleaned up after 2 minutes');
  }, 300_000);
};



    const handleAddResource = () => {
        if (fields.length >= 10) {
            alert('Можно добавить максимум 10 ресурсов.');
            return;
        }
        append({ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' });
    };

    if (!hunter) return <div className="print-form">Загрузка...</div>;

    return (
        <div className="print-form">
            <button className="back" onClick={() => navigate('/')}>← Назад</button>
            <h1>Заполнение данных для печати</h1>

            <div className="hunter-info">
                <h2>Данные охотника</h2>
                <div className="hunter-fields">
                    <div><strong>ФИО:</strong> {hunter.fullName}</div>
                    <div><strong>Охотничий билет:</strong> {hunter.series} №{hunter.number}</div>
                    <div><strong>Дата выдачи:</strong> {new Date(hunter.issueDate).toLocaleDateString()}</div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <h2>Параметры охоты</h2>

                <div className="config-fields">
                    <label>
                        Наименование организации:
                        <input {...register('organizationName')} />
                    </label>
                    <label>
                        Место охоты:
                        <input {...register('huntingPlace')} />
                    </label>
                    <label>
                        ФИО выдавшего:
                        <input {...register('issuedByName')} />
                    </label>
                </div>

                {fields.map((field, index) => (
                    <div key={field.id} className="resource-group">
                        <input {...register(`resources.${index}.resource`)} placeholder="Вид ресурса" />
                        <div className="dates">
                            <label>С: <input type="date" {...register(`resources.${index}.dateFrom`)} /></label>
                            <label>По: <input type="date" {...register(`resources.${index}.dateTo`)} /></label>
                        </div>
                        <input {...register(`resources.${index}.dailyLimit`)} placeholder="Норма за день" />
                        <input {...register(`resources.${index}.seasonLimit`)} placeholder="Норма за сезон" />
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

                    <button type="button" className="print" onClick={handleSubmit(onPrint)}>Печать</button>
                    <button type="submit" className="submit">Сформировать бланк</button>
            </form>
        </div>
    );
};

export default PrintForm;
