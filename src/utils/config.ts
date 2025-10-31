export interface PrintConfig {
    issuedByName: string;
    organizationName: string;
    huntingPlace: string;
    huntType:string;
    jobTitle:string;
}

const CONFIG_KEY = 'printConfig';

export const getConfig = (): PrintConfig => {
    const cfg = localStorage.getItem(CONFIG_KEY);
    return cfg ? JSON.parse(cfg) : { issuedByName: '', organizationName: '', huntingPlace: '', huntType:'', jobTitle:'' };
};

export const setConfig = (cfg: PrintConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
};
