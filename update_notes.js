const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'frontend/src/components/notes/InitialNoteForm.tsx',
  'frontend/src/components/notes/ProgressNoteForm.tsx'
];

for (const relPath of filesToUpdate) {
  const filePath = path.join(__dirname, relPath);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove import
  content = content.replace(/import type \{ MedUnitValue \} from '@\/types\/medication';\r?\n/, '');

  // Remove unit state
  content = content.replace(/const \[newMedUnit, setNewMedUnit\] = useState<MedUnitValue>\('MG'\);\r?\n/, '');

  // Fix dose casting and remove unit mapping
  content = content.replace(/dose: m\.dose \? Number\(m\.dose\) : undefined,\s*unit: m\.unit,/g, 'dose: m.dose || undefined,');

  // Fix validMeds map string case
  content = content.replace(/\{ name: m, dose: '', unit: 'MG' \}/g, "{ name: m, dose: '' }");

  // Fix view output text (InitialNoteForm)
  content = content.replace(/<span>\{med\.name\} \{med\.dose\}\{med\.unit\}<\/span>/g, "<span>{med.name} {med.dose}</span>");

  // Fix view output text (snapshot mapping)
  content = content.replace(/<span className="font-mono text-accent font-semibold ml-1\.5">\{med\.dose\}\{med\.unit\}<\/span>/g, "<span className=\"font-mono text-accent font-semibold ml-1.5\">{med.dose}</span>");

  // Fix input form 
  content = content.replace(/<div className="col-span-6 flex flex-col gap-1">\s*<label className="text-\[10px\] font-bold text-text-secondary uppercase">Dose<\/label>\s*<input \s*type="number" \s*value=\{newMedDose\}\s*onChange=\{\(e\) => setNewMedDose\(e\.target\.value\)\}\s*placeholder="e\.g\. 10" \s*className="h-\[28px\] px-2 text-\[12px\] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-\[0_0_0_3px_rgba\(10,110,95,0\.12\)\]" \s*\/>\s*<\/div>\s*<div className="col-span-6 flex flex-col gap-1">\s*<label className="text-\[10px\] font-bold text-text-secondary uppercase">Unit<\/label>\s*<select \s*value=\{newMedUnit\}\s*onChange=\{\(e\) => setNewMedUnit\(e\.target\.value as MedUnitValue\)\}\s*className="h-\[28px\] px-1 text-\[12px\] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all cursor-pointer focus:shadow-\[0_0_0_3px_rgba\(10,110,95,0\.12\)\]"\s*>\s*<option value="MG">MG<\/option>\s*<option value="G">G<\/option>\s*<option value="MCG">MCG<\/option>\s*<option value="ML">ML<\/option>\s*<option value="UNITS">UNITS<\/option>\s*<\/select>\s*<\/div>/g, 
  `<div className="col-span-12 md:col-span-12 flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Dose</label>
                              <input 
                                type="text" 
                                value={newMedDose}
                                onChange={(e) => setNewMedDose(e.target.value)}
                                placeholder="e.g. 10mg" 
                                className="h-[28px] px-2 text-[12px] rounded border border-border-strong outline-none focus:border-accent w-full bg-white transition-all focus:shadow-[0_0_0_3px_rgba(10,110,95,0.12)]" 
                              />
                            </div>`);
                            
  // Fix adding logic
  content = content.replace(/dose: parseFloat\(newMedDose\),\s*unit: newMedUnit,/g, 'dose: newMedDose.trim(),');
  content = content.replace(/setNewMedUnit\('MG'\);\r?\n\s*/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${relPath}`);
}
