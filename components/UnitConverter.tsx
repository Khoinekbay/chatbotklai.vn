
import React, { useState } from 'react';
import { ScaleIcon, XIcon } from './Icons';

interface UnitConverterProps {
  // No specific props needed
}

const UnitConverter: React.FC<UnitConverterProps> = () => {
  const [category, setCategory] = useState<'length' | 'mass' | 'temperature'>('length');
  const [input, setInput] = useState<number | ''>('');
  const [fromUnit, setFromUnit] = useState<string>('m');
  const [toUnit, setToUnit] = useState<string>('cm');

  const categories = {
    length: {
        name: 'Độ dài',
        units: [
            { id: 'm', name: 'Mét (m)', factor: 1 },
            { id: 'km', name: 'Kilômét (km)', factor: 1000 },
            { id: 'cm', name: 'Xentimét (cm)', factor: 0.01 },
            { id: 'mm', name: 'Milimét (mm)', factor: 0.001 },
            { id: 'inch', name: 'Inch (in)', factor: 0.0254 },
            { id: 'ft', name: 'Feet (ft)', factor: 0.3048 },
        ]
    },
    mass: {
        name: 'Khối lượng',
        units: [
            { id: 'kg', name: 'Kilôgam (kg)', factor: 1 },
            { id: 'g', name: 'Gam (g)', factor: 0.001 },
            { id: 'mg', name: 'Miligam (mg)', factor: 0.000001 },
            { id: 'lb', name: 'Pound (lb)', factor: 0.453592 },
            { id: 'oz', name: 'Ounce (oz)', factor: 0.0283495 },
        ]
    },
    temperature: {
        name: 'Nhiệt độ',
        units: [
            { id: 'c', name: 'Celsius (°C)' },
            { id: 'f', name: 'Fahrenheit (°F)' },
            { id: 'k', name: 'Kelvin (K)' },
        ]
    }
  };

  const convert = (val: number, from: string, to: string, type: string) => {
      if (type === 'length' || type === 'mass') {
          const cat = categories[type as 'length' | 'mass'];
          const fromFactor = cat.units.find(u => u.id === from)?.factor || 1;
          const toFactor = cat.units.find(u => u.id === to)?.factor || 1;
          return (val * fromFactor) / toFactor;
      } else {
          // Temperature conversion
          if (from === to) return val;
          let cVal = val;
          if (from === 'f') cVal = (val - 32) * 5/9;
          if (from === 'k') cVal = val - 273.15;
          
          if (to === 'c') return cVal;
          if (to === 'f') return cVal * 9/5 + 32;
          if (to === 'k') return cVal + 273.15;
          return val;
      }
  };

  const result = input !== '' ? convert(Number(input), fromUnit, toUnit, category) : '---';

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border">
            {(Object.keys(categories) as Array<keyof typeof categories>).map(cat => (
                <button
                    key={cat}
                    onClick={() => {
                        setCategory(cat);
                        setFromUnit(categories[cat].units[0].id);
                        setToUnit(categories[cat].units[1].id);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${category === cat ? 'bg-brand text-white' : 'bg-input-bg hover:bg-sidebar text-text-secondary'}`}
                >
                    {categories[cat].name}
                </button>
            ))}
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Từ</label>
                    <input 
                        type="number" 
                        value={input} 
                        onChange={(e) => setInput(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-2xl font-bold bg-transparent border-b-2 border-border focus:border-brand focus:outline-none p-2"
                        placeholder="0"
                    />
                    <select 
                        value={fromUnit} 
                        onChange={(e) => setFromUnit(e.target.value)}
                        className="w-full p-2 bg-input-bg rounded-lg text-sm"
                    >
                        {categories[category].units.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-center">
                    <div className="bg-sidebar p-2 rounded-full">
                        <ScaleIcon className="w-6 h-6 text-text-secondary" />
                    </div>
                </div>

                <div className="space-y-2">
                     <label className="text-xs font-semibold text-text-secondary uppercase">Sang</label>
                     <div className="w-full text-2xl font-bold text-brand p-2 border-b-2 border-transparent">
                         {typeof result === 'number' ? result.toLocaleString(undefined, { maximumFractionDigits: 4 }) : result}
                     </div>
                     <select 
                        value={toUnit} 
                        onChange={(e) => setToUnit(e.target.value)}
                        className="w-full p-2 bg-input-bg rounded-lg text-sm"
                    >
                        {categories[category].units.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    </div>
  );
};

export default UnitConverter;
