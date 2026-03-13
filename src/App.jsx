import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { 
  PlusCircle, List, TrendingUp, Image as ImageIcon, Trash2, Edit, Download, Upload, AlertTriangle, ArrowRightLeft, Camera
} from 'lucide-react';

const HEIGHT_CM = 172;
const MAX_IMG_WIDTH = 800;
const IMG_QUALITY = 0.7;

const INITIAL_FORM = {
  id: '',
  date: new Date().toISOString().split('T')[0],
  weight: '',
  phase: 'Mentinere',
  shoulders: '',
  waist: '',
  hips: '',
  thigh: '',
  calf: '',
  photo: null,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('add');
  const [entries, setEntries] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [storageError, setStorageError] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const [compareDate1, setCompareDate1] = useState('');
  const [compareDate2, setCompareDate2] = useState('');
  const [sliderPos, setSliderPos] = useState(50);

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('fitness_data_women');
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch (e) {
        console.error("Eroare la parsarea datelor", e);
      }
    }
  }, []);

  const saveEntries = (newEntries) => {
    try {
      const sorted = [...newEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
      localStorage.setItem('fitness_data_women', JSON.stringify(sorted));
      setEntries(sorted);
      setStorageError(null);
    } catch (e) {
      setStorageError("Spațiul de stocare este plin (limita de 5MB). Șterge intrări vechi sau exportă datele JSON.");
    }
  };

  const calculateMetrics = (data) => {
    const weight = parseFloat(data.weight) || 0;
    const waist = parseFloat(data.waist) || 0;
    const hips = parseFloat(data.hips) || 0;

    let bf = 0;
    let lbm = 0;
    let hourglass = 0;

    if (hips > 0 && waist > 0) {
      hourglass = parseFloat((waist / hips).toFixed(2));
    }

    if (waist > 0) {
      const bfRaw = 76 - (20 * (HEIGHT_CM / waist));
      bf = parseFloat(bfRaw.toFixed(1));
      if (bf < 0) bf = 0;
    }

    if (weight > 0 && bf > 0) {
      lbm = parseFloat((weight * (1 - bf / 100)).toFixed(1));
    }

    return { ...data, bf, lbm, hourglass };
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > MAX_IMG_WIDTH) {
            height = Math.round((height * MAX_IMG_WIDTH) / width);
            width = MAX_IMG_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setFormData({ ...formData, photo: compressedBase64 });
    } catch (error) {
      alert("Eroare la procesarea imaginii.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.hips || !formData.waist) {
      alert("Talia și șoldurile sunt obligatorii pentru calcule!");
      return;
    }

    const processedData = calculateMetrics({
      ...formData,
      id: formData.id || Date.now().toString(),
    });

    if (formData.id) {
      saveEntries(entries.map(ent => ent.id === formData.id ? processedData : ent));
    } else {
      saveEntries([...entries, processedData]);
    }

    setFormData(INITIAL_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setActiveTab('history');
  };

  const editEntry = (entry) => {
    setFormData(entry);
    setActiveTab('add');
  };

  const deleteEntry = (id) => {
    if (window.confirm("Sigur vrei să ștergi această înregistrare?")) {
      saveEntries(entries.filter(e => e.id !== id));
    }
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "fitness_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          saveEntries(imported);
        }
      } catch (err) {
        alert("Fișier JSON invalid.");
      }
    };
    reader.readAsText(file);
  };

  const getContextualBadge = (current, previous, metric, phase) => {
    if (!previous || previous[metric] === undefined || current[metric] === undefined || current[metric] === '') return null;
    const diff = parseFloat(current[metric]) - parseFloat(previous[metric]);
    if (diff === 0) return null;

    let isGood = false;
    const isPositive = diff > 0;

    if (metric === 'weight') {
      if (phase === 'Deficit') isGood = !isPositive;
      else if (phase === 'Surplus') isGood = isPositive;
      else isGood = Math.abs(diff) < 1;
    } else if (metric === 'bf' || metric === 'waist') {
      isGood = !isPositive;
    } else if (metric === 'lbm' || metric === 'hips') {
      isGood = isPositive; 
    } else {
      isGood = phase === 'Deficit' ? !isPositive : isPositive;
    }

    const sign = isPositive ? '+' : '';
    const colorClass = isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

    return (
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ml-1 ${colorClass}`}>
        {sign}{diff.toFixed(1)}
      </span>
    );
  };

  const getHourglassFeedback = (ratio) => {
    if (!ratio) return { text: "Date insuficiente", color: "text-slate-500" };
    if (ratio < 0.70) return { text: "Clepsidră accentuată. Talie foarte subțire comparativ cu șoldurile.", color: "text-violet-600" };
    if (ratio <= 0.75) return { text: "Clepsidră ideală/standard. Proporții feminine echilibrate.", color: "text-emerald-600" };
    if (ratio <= 0.80) return { text: "Formă atletică sau 'pară'. Diferența talie-șolduri este moderată.", color: "text-blue-600" };
    return { text: "Formă dreptunghiulară sau 'măr'. Talie și șolduri cu circumferințe apropiate.", color: "text-amber-600" };
  };

  const chartData = useMemo(() => {
    return entries.map((entry, index, arr) => {
      let movingAvg = null;
      if (index >= 2) {
        const sum = parseFloat(arr[index].weight) + parseFloat(arr[index-1].weight) + parseFloat(arr[index-2].weight);
        movingAvg = parseFloat((sum / 3).toFixed(1));
      }
      return { ...entry, movingAvgWeight: movingAvg };
    });
  }, [entries]);

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <Edit className="w-5 h-5 mr-2 text-rose-500" /> Date Generale
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Data</label>
            <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2.5 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fază Nutriție</label>
            <select name="phase" value={formData.phase} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2.5 border">
              <option value="Surplus">Surplus (Bulk)</option>
              <option value="Deficit">Deficit (Cut)</option>
              <option value="Mentinere">Menținere</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">Greutate (kg)</label>
            <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2.5 border" placeholder="ex: 62.5" />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-violet-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Circumferințe (cm)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'waist', label: 'Talie', required: true },
            { id: 'hips', label: 'Șolduri/Fesieri', required: true },
            { id: 'shoulders', label: 'Umeri' },
            { id: 'thigh', label: 'Coapsă' },
            { id: 'calf', label: 'Gambă' },
          ].map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
              <input type="number" step="0.1" name={field.id} value={formData[field.id]} onChange={handleInputChange} required={field.required} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-violet-500 focus:ring-violet-500 p-2 border text-sm" placeholder="cm" />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">* Talia este necesară pt. estimarea Body Fat (RFM), iar șoldurile pentru proporții.</p>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
          <Camera className="w-5 h-5 mr-2 text-slate-500" /> Poză Progres
        </h3>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer" />
        {isCompressing && <p className="text-sm text-violet-600 mt-2 animate-pulse">Comprimare imagine...</p>}
        {formData.photo && !isCompressing && (
          <img src={formData.photo} alt="Preview" className="mt-4 w-32 h-32 object-cover rounded-xl border-2 border-slate-200 shadow-sm" />
        )}
      </div>

      <button type="submit" disabled={isCompressing} className="w-full bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
        {formData.id ? 'Salvează Modificările' : 'Adaugă Măsurătoare'}
      </button>
    </form>
  );

  const renderHistory = () => {
    if (entries.length === 0) return <div className="text-center py-12 text-slate-500">Nicio intrare. Adaugă prima măsurătoare!</div>;
    
    const reversedEntries = [...entries].reverse();

    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Istoric Măsurători</h2>
          <div className="flex gap-2">
            <button onClick={exportData} className="p-2 bg-white text-slate-600 rounded-lg shadow-sm border hover:bg-slate-50" title="Export JSON"><Download className="w-5 h-5" /></button>
            <label className="p-2 bg-white text-slate-600 rounded-lg shadow-sm border hover:bg-slate-50 cursor-pointer" title="Import JSON">
              <Upload className="w-5 h-5" />
              <input type="file" accept=".json" onChange={importData} className="hidden" ref={importInputRef} />
            </label>
          </div>
        </div>

        {reversedEntries.map((entry, index) => {
          const previous = reversedEntries[index + 1]; 
          
          return (
            <div key={entry.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
              <div className="flex-shrink-0 relative group">
                {entry.photo ? (
                  <img src={entry.photo} alt="Progres" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-slate-200" />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <span className="absolute -top-2 -right-2 bg-violet-100 text-violet-800 text-[10px] font-bold px-2 py-1 rounded-full border border-violet-200 shadow-sm">{entry.phase}</span>
              </div>
              
              <div className="flex-grow grid grid-cols-2 gap-y-2 text-sm">
                <div className="col-span-2 font-semibold text-slate-800 border-b pb-1 mb-1">
                  {new Date(entry.date).toLocaleDateString('ro-RO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                
                <div>
                  <span className="text-slate-500">Greutate:</span> {entry.weight} kg 
                  {getContextualBadge(entry, previous, 'weight', entry.phase)}
                </div>
                <div>
                  <span className="text-slate-500">LBM:</span> {entry.lbm || '-'} kg
                  {getContextualBadge(entry, previous, 'lbm', entry.phase)}
                </div>
                <div>
                  <span className="text-slate-500">BF%:</span> {entry.bf || '-'} %
                  {getContextualBadge(entry, previous, 'bf', entry.phase)}
                </div>
                <div>
                  <span className="text-slate-500">Talie/Șold:</span> {entry.waist || '-'}/{entry.hips} cm
                </div>
              </div>

              <div className="flex sm:flex-col justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 sm:border-l pl-0 sm:pl-3">
                <button onClick={() => editEntry(entry)} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>
                <button onClick={() => deleteEntry(entry.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCharts = () => {
    if (entries.length < 2) return <div className="text-center py-12 text-slate-500">Sunt necesare minim 2 intrări pentru a genera grafice.</div>;

    const latestEntry = entries[entries.length - 1];
    const hourglassData = getHourglassFeedback(latestEntry.hourglass);

    return (
      <div className="space-y-8 animate-fadeIn">
        <div className="bg-gradient-to-br from-white to-rose-50 p-5 rounded-2xl shadow-sm border border-rose-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Analiză Proporții (Hourglass Score)</h3>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-bold text-slate-800">{latestEntry.hourglass || '-'}</span>
            <span className="text-sm text-slate-500 mb-1">raport talie/șolduri</span>
          </div>
          <p className={`text-sm font-medium ${hourglassData.color}`}>{hourglassData.text}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Evoluție Greutate & Trend</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString('ro-RO', {month: 'short', day: 'numeric'})} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="weight" name="Greutate (kg)" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorWeight)" />
                <Line type="monotone" dataKey="movingAvgWeight" name="Trend (Medie 3)" stroke="#f43f5e" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Compoziție Corporală (LBM vs BF%)</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLBM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString('ro-RO', {month: 'short'})} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fill: '#10b981'}} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{fill: '#f59e0b'}} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Area yAxisId="left" type="monotone" dataKey="lbm" name="Masa Slabă (kg)" stroke="#10b981" fillOpacity={1} fill="url(#colorLBM)" />
                <Area yAxisId="right" type="monotone" dataKey="bf" name="Body Fat %" stroke="#f59e0b" fillOpacity={1} fill="url(#colorBF)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Evoluție Circumferințe Cheie</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString('ro-RO', {month: 'short'})} />
                <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="waist" name="Talie (cm)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="hips" name="Șolduri (cm)" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="thigh" name="Coapsă (cm)" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderCompare = () => {
    const photosWithDates = entries.filter(e => e.photo).map(e => ({ id: e.id, date: e.date, photo: e.photo }));
    
    if (photosWithDates.length < 2) {
      return <div className="text-center py-12 text-slate-500">Sunt necesare minim 2 intrări cu poză pentru comparare.</div>;
    }

    if (!compareDate1 && photosWithDates.length > 0) setCompareDate1(photosWithDates[0].id);
    if (!compareDate2 && photosWithDates.length > 1) setCompareDate2(photosWithDates[photosWithDates.length - 1].id);

    const img1 = photosWithDates.find(p => p.id === compareDate1)?.photo;
    const img2 = photosWithDates.find(p => p.id === compareDate2)?.photo;

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Înainte (Poză Sub)</label>
            <select value={compareDate1} onChange={e => setCompareDate1(e.target.value)} className="w-full rounded-xl border-slate-200 p-2 text-sm focus:ring-rose-500">
              {photosWithDates.map(p => <option key={p.id} value={p.id}>{p.date}</option>)}
            </select>
          </div>
          <ArrowRightLeft className="w-6 h-6 text-slate-300 hidden sm:block mt-5" />
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1">După (Poză Deasupra)</label>
            <select value={compareDate2} onChange={e => setCompareDate2(e.target.value)} className="w-full rounded-xl border-slate-200 p-2 text-sm focus:ring-violet-500">
              {photosWithDates.map(p => <option key={p.id} value={p.id}>{p.date}</option>)}
            </select>
          </div>
        </div>

        {img1 && img2 && (
          <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200">
            <img src={img1} alt="Înainte" className="absolute top-0 left-0 w-full h-full object-cover" />
            <img 
              src={img2} 
              alt="După" 
              className="absolute top-0 left-0 w-full h-full object-cover" 
              style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
            />
            
            <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize drop-shadow-md z-10" style={{ left: `calc(${sliderPos}% - 2px)` }}>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-slate-200">
                 <ArrowRightLeft className="w-4 h-4 text-slate-600" />
               </div>
            </div>

            <input 
              type="range" 
              min="0" max="100" 
              value={sliderPos} 
              onChange={(e) => setSliderPos(e.target.value)}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-rose-50 text-slate-800 font-sans pb-24">
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-rose-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black bg-gradient-to-r from-rose-500 to-violet-600 bg-clip-text text-transparent tracking-tight">
            FitFemme
          </h1>
          <div className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            Înălțime setată: {HEIGHT_CM} cm
          </div>
        </div>
      </header>

      {storageError && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-700 p-4 rounded-r-lg flex items-start shadow-sm">
            <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{storageError}</p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === 'add' && renderForm()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'charts' && renderCharts()}
        {activeTab === 'compare' && renderCompare()}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-3xl mx-auto flex justify-around">
          {[
            { id: 'add', icon: PlusCircle, label: 'Adaugă' },
            { id: 'history', icon: List, label: 'Istoric' },
            { id: 'charts', icon: TrendingUp, label: 'Evoluție' },
            { id: 'compare', icon: ImageIcon, label: 'Comparare' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full py-3 px-1 transition-colors ${
                  isActive ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'animate-bounce-short' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{__html: `
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes bounceShort { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .animate-bounce-short { animation: bounceShort 0.3s ease-in-out; }
      `}} />
    </div>
  );
}
