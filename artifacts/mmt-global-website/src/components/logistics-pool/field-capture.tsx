import { useState, type FormEvent } from "react";
import { useCreateLogisticsFieldIntake, type LogisticsFieldIntakeInput, type LogisticsFieldIntakeResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, ClipboardPlus, Truck } from "lucide-react";
import { describeError, inputCls } from "@/components/logistics-ops/shared";
import type { Act } from "./pool-panels";

type FieldKind = "load" | "empty_truck";
type Values = Record<string, string>;
const LOAD_REGIONS = ["Mersin", "İskenderun", "Gaziantep", "Adana"] as const;
const EMPTY_ORIGINS = ["Mardin", "Şanlıurfa"] as const;
const EMPTY_DESTINATIONS = LOAD_REGIONS;
const modes = [{ value: "road", label: "Karayolu" }, { value: "sea", label: "Denizyolu" }, { value: "air", label: "Havayolu" }] as const;

function Input({ label, name, values, set, type = "text", required = true, step, min, hint }: {
  label: string; name: string; values: Values; set: (k: string, v: string) => void;
  type?: string; required?: boolean; step?: string; min?: string; hint?: string;
}) {
  return <label className="block min-w-0 space-y-1.5 text-xs font-medium text-foreground/75">
    <span>{label}</span>
    <input className={`${inputCls} w-full`} name={name} type={type} required={required} step={step} min={min} value={values[name] ?? ""}
      onChange={e => set(name,e.target.value)} />
    {hint ? <span className="block text-[11px] font-normal leading-5 text-foreground/50">{hint}</span> : null}
  </label>;
}

export function FieldCapture({ refresh }: { refresh: () => Promise<unknown> }) {
  const [kind,setKind] = useState<FieldKind>("load");
  const [region,setRegion] = useState<string>("Mersin");
  const [destination,setDestination] = useState<string>("Mersin");
  const [mode,setMode] = useState<"road"|"sea"|"air">("road");
  const [values,setValues] = useState<Values>({});
  const [consent,setConsent] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [result,setResult] = useState<LogisticsFieldIntakeResult|null>(null);
  const mutation=useCreateLogisticsFieldIntake();
  const change=(key:string,value:string) => setValues(v=>({...v,[key]:value}));

  function selectKind(value:FieldKind) {
    setKind(value);setValues({});setConsent(false);setError(null);setResult(null);
    setRegion(value==="load"?"Mersin":"Mardin");setDestination("Mersin");
  }

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError(null);setResult(null);
    if(!consent){setError("Kişinin MMT içi eşleştirme için iletişim iznini teyit edin.");return;}
    let body:LogisticsFieldIntakeInput;
    if(kind==="load") {
      const tons=Number(values.weightTon);
      const volume=values.volumeM3?.trim()?Number(values.volumeM3):0;
      if(!(tons>0)||!Number.isFinite(volume)||volume<0){setError("Ton ve hacim alanlarını kontrol edin. Hacim ölçülmediyse 0 bırakın.");return;}
      body={type:"load",region:region as typeof LOAD_REGIONS[number],requesterName:values.requesterName??"",organization:values.organization,
        email:values.email??"",phone:values.phone??"",destination:destination.trim(),cargoType:values.cargoType??"",
        weightKg:tons*1000,volumeM3:volume,transportMode:mode,loadingDate:values.loadingDate??"",notes:
          [values.notes?.trim(),...(volume===0?["Saha kaydı: hacim ölçülmedi; teyit gerekli."]:[])].filter(Boolean).join(" · "),
        contactUseConfirmed:true};
    } else {
      body={type:"empty_truck",region:region as typeof EMPTY_ORIGINS[number],targetDestination:destination as typeof EMPTY_DESTINATIONS[number],
        companyName:values.companyName??"",contactName:values.contactName??"",email:values.email??"",phone:values.phone??"",
        transportMode:mode,capacity:values.capacity??"",availability:values.availability??"",notes:values.notes,contactUseConfirmed:true};
    }
    try {const saved=await mutation.mutateAsync({data:body});setResult(saved);setValues({});setConsent(false);await refresh();}
    catch(err){setError(describeError(err));}
  }

  return <section className="mt-5 max-w-3xl border border-border bg-card p-4 sm:p-6" data-testid="panel-field-capture">
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-1 rounded-full border border-primary/30 bg-primary/10 p-2 text-primary"><ClipboardPlus size={17}/></div>
      <div><h2 className="text-lg font-semibold">Mersin saha pilotu — gerçek kayıt</h2>
        <p className="mt-1 text-xs leading-5 text-foreground/55">Sahadan yalnız gerçek ve izinli bilgileri girin. Kayıt mevcut MMT lojistik akışına eklenir; bu form mesaj, teklif, sözleşme veya sevkiyat göndermez.</p>
      </div>
    </div>
    <div className="mb-5 grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={kind==="load"} data-testid="capture-load" onClick={()=>selectKind("load")}
        className={`flex items-center justify-center gap-2 border p-3 text-sm font-semibold ${kind==="load"?"border-primary bg-primary/10":"border-border text-foreground/55"}`}>Yük talebi</button>
      <button type="button" aria-pressed={kind==="empty_truck"} data-testid="capture-empty-truck" onClick={()=>selectKind("empty_truck")}
        className={`flex items-center justify-center gap-2 border p-3 text-sm font-semibold ${kind==="empty_truck"?"border-primary bg-primary/10":"border-border text-foreground/55"}`}><Truck size={15}/>Boş araç</button>
    </div>
    <form onSubmit={submit} className="space-y-4" data-testid="form-field-intake">
      {kind==="load" ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Yükün bulunduğu bölge</span><select className={`${inputCls} w-full`} value={region} onChange={e=>setRegion(e.target.value)}>{LOAD_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
          <Input label="Varış noktası" name="destination" values={{...values,destination}} set={(_k,v)=>setDestination(v)} required />
          <Input label="Yük sahibi / saha irtibatı" name="requesterName" values={values} set={change} />
          <Input label="Firma (varsa)" name="organization" values={values} set={change} required={false} />
          <Input label="E-posta" name="email" values={values} set={change} type="email" />
          <Input label="Telefon" name="phone" values={values} set={change} type="tel" />
          <Input label="Yük tanımı" name="cargoType" values={values} set={change} />
          <Input label="Ağırlık (ton)" name="weightTon" values={values} set={change} type="number" step="0.01" min="0.01" />
          <Input label="Hacim (m³)" name="volumeM3" values={values} set={change} type="number" step="0.01" min="0" required={false} hint="Ölçülmediyse boş bırakın; sistem hacim teyidi gerektiğini işaretler."/>
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Taşıma türü</span><select className={`${inputCls} w-full`} value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{modes.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
          <Input label="Yükleme tarihi" name="loadingDate" values={values} set={change} type="date" min={new Date().toISOString().slice(0,10)} />
        </div>
      </> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Boş aracın bulunduğu il</span><select className={`${inputCls} w-full`} value={region} onChange={e=>setRegion(e.target.value)}>{EMPTY_ORIGINS.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Gitmek istediği bölge</span><select className={`${inputCls} w-full`} value={destination} onChange={e=>setDestination(e.target.value)}>{EMPTY_DESTINATIONS.map(x=><option key={x}>{x}</option>)}</select></label>
          <Input label="Taşıyıcı firma" name="companyName" values={values} set={change} />
          <Input label="Yetkili irtibat" name="contactName" values={values} set={change} />
          <Input label="E-posta" name="email" values={values} set={change} type="email" />
          <Input label="Telefon" name="phone" values={values} set={change} type="tel" />
          <Input label="Kapasite (ör. 24 ton)" name="capacity" values={values} set={change} />
          <Input label="Müsait olduğu tarih" name="availability" values={values} set={change} type="date" min={new Date().toISOString().slice(0,10)} />
          <label className="block space-y-1.5 text-xs text-foreground/75"><span>Araç türü</span><select className={`${inputCls} w-full`} value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{modes.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
        </div>
      </>}
      <label className="block space-y-1.5 text-xs text-foreground/75"><span>Saha notu (isteğe bağlı)</span><textarea className={`${inputCls} min-h-20 w-full`} maxLength={2000} value={values.notes??""} onChange={e=>change("notes",e.target.value)}/></label>
      <label className="flex items-start gap-3 border border-border bg-background p-3 text-xs leading-5 text-foreground/70">
        <input type="checkbox" className="mt-1 accent-primary" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>
        <span>Kişinin iletişim bilgilerinin MMT içinde bu talep veya taşıyıcı eşleştirmesi için kaydedilmesine izin verdiğini doğruladım. Bu izin dışarıya mesaj göndermek veya bilgiyi yayımlamak için değildir.</span>
      </label>
      {error?<p role="alert" className="flex gap-2 border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs text-red-200"><AlertTriangle size={14}/>{error}</p>:null}
      {result?<p role="status" className="flex gap-2 border-l-2 border-emerald-400 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 size={14}/>{result.recordType==="load"?"Yük talebi kaydedildi":"Taşıyıcı başvurusu kaydedildi"} — {result.referenceCode}. {result.recordType==="empty_truck"?"Kurucu incelemesi bekliyor.":"Eşleşme onayı ve sonraki işlem ayrıca gerekir."}</p>:null}
      <button type="submit" disabled={mutation.isPending||!consent} className="w-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" data-testid="button-submit-field-intake">
        {mutation.isPending?"Kaydediliyor…":"Saha kaydını güvenli şekilde kaydet"}
      </button>
    </form>
  </section>;
}
