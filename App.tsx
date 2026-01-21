
import React, { useState, useEffect } from 'react';
import { Exercise, Profile, WeekData, AppData } from './types.ts';

const App: React.FC = () => {
  // --- State ---
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [weekData, setWeekData] = useState<WeekData>({});
  
  // Modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isEditExerciseModalOpen, setIsEditExerciseModalOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  
  // Notification state
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // --- Helpers ---
  const showNotification = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  /**
   * Formata a data de forma segura ignorando o fuso horário local
   * Garante que se foi salvo "2025-06-06", mostre exatamente "06/06/2025"
   */
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    // O input type="date" retorna YYYY-MM-DD
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const calculateEvolutionTime = (startDate: string) => {
    if (!startDate) return "0 dias";
    const parts = startDate.split('T')[0].split('-').map(Number);
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const remainingDays = diffDays % 30;
    
    let display = "";
    if (years > 0) {
      display += `${years} ano${years > 1 ? 's' : ''}`;
      if (months > 0) display += ` e ${months} mes${months > 1 ? 'es' : ''}`;
    } else if (months > 0) {
      display += `${months} mes${months > 1 ? 'es' : ''}`;
      if (remainingDays > 0) display += ` e ${remainingDays} dia${remainingDays > 1 ? 's' : ''}`;
    } else {
      display += `${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
    }
    return display;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // --- Persistence ---
  useEffect(() => {
    const savedProfiles = localStorage.getItem('workoutProfiles');
    const savedCurrent = localStorage.getItem('currentProfile');
    const savedWeek = localStorage.getItem('weekData');

    if (savedProfiles) setProfiles(JSON.parse(savedProfiles));
    if (savedCurrent) setCurrentProfileId(savedCurrent);
    if (savedWeek) setWeekData(JSON.parse(savedWeek));
  }, []);

  useEffect(() => {
    if (Object.keys(profiles).length > 0) {
      localStorage.setItem('workoutProfiles', JSON.stringify(profiles));
    }
    localStorage.setItem('currentProfile', currentProfileId);
    localStorage.setItem('weekData', JSON.stringify(weekData));
  }, [profiles, currentProfileId, weekData]);

  const currentProfile = profiles[currentProfileId] || null;
  const exercises: Record<string, Exercise> = currentProfile?.exercises || {};

  // --- Handlers ---
  const handleBackup = () => {
    const data: AppData = { profiles, currentProfileId, weekData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-treinos-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotification('Backup realizado com sucesso!');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data: AppData = JSON.parse(event.target?.result as string);
        if (data.profiles) setProfiles(data.profiles);
        if (data.currentProfileId) setCurrentProfileId(data.currentProfileId);
        if (data.weekData) setWeekData(data.weekData);
        showNotification('Dados restaurados com sucesso!');
      } catch (err) {
        showNotification('Erro ao restaurar arquivo.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteProfile = (id: string) => {
    if (window.confirm(`Tem certeza que deseja excluir este perfil permanentemente?`)) {
      setProfiles(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (currentProfileId === id) setCurrentProfileId('');
      showNotification('Perfil excluído.');
    }
  };

  const handleToggleDay = (dateStr: string) => {
    if (!currentProfileId) return;
    setWeekData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const currentDayData = next[dateStr][currentProfileId] || { trained: false, exercises: {} };
      
      const newTrainedStatus = !currentDayData.trained;
      const newDayExercises = { ...currentDayData.exercises };
      
      if (newTrainedStatus) {
        Object.keys(exercises).forEach(exId => {
          newDayExercises[exId] = true;
        });
      } else {
        Object.keys(newDayExercises).forEach(exId => {
          newDayExercises[exId] = false;
        });
      }

      next[dateStr][currentProfileId] = {
        trained: newTrainedStatus,
        exercises: newDayExercises
      };
      return next;
    });
  };

  const handleToggleDayExercise = (dateStr: string, exId: string) => {
    setWeekData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const currentDayData = next[dateStr][currentProfileId] || { trained: false, exercises: {} };
      
      const newDayExercises = { ...currentDayData.exercises };
      newDayExercises[exId] = !newDayExercises[exId];
      
      const anyDone = Object.values(newDayExercises).some(v => v);
      
      next[dateStr][currentProfileId] = {
        trained: anyDone,
        exercises: newDayExercises
      };
      return next;
    });
  };

  const handleUpdateWeight = (exId: string, weight: number) => {
    setProfiles(prev => {
      if (!prev[currentProfileId]) return prev;
      const next = { ...prev };
      const profile = { ...next[currentProfileId] };
      const exMap = { ...profile.exercises };
      const ex = { ...exMap[exId] };
      
      ex.currentWeight = weight;
      ex.lastUpdated = new Date().toISOString();
      exMap[exId] = ex;
      profile.exercises = exMap;
      next[currentProfileId] = profile;
      return next;
    });
    showNotification('Peso atualizado!');
  };

  const handleDeleteExercise = (exId: string) => {
    if (window.confirm('Excluir este exercício permanentemente?')) {
      setProfiles(prev => {
        if (!prev[currentProfileId]) return prev;
        const next = { ...prev };
        const profile = { ...next[currentProfileId] };
        const exMap = { ...profile.exercises };
        delete exMap[exId];
        profile.exercises = exMap;
        next[currentProfileId] = profile;
        return next;
      });
      showNotification('Exercício removido.');
    }
  };

  const ExerciseCard: React.FC<{ exercise: Exercise }> = ({ exercise }) => {
    const [weightInput, setWeightInput] = useState(exercise.currentWeight);
    const updateDate = new Date(exercise.lastUpdated);

    return (
      <div className="exercise-card glass-card rounded-2xl p-6 flex flex-col transition-all-300 hover-elevate border border-slate-100 group h-full relative z-0">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-2">
            <h3 className="font-black text-xl text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tighter break-words">
              {exercise.name}
            </h3>
            <span className="text-[10px] text-slate-400 block">Desde: {formatDateDisplay(exercise.dateAdded)}</span>
          </div>
          <div className="flex gap-1 shrink-0 relative z-20">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditingExerciseId(exercise.id);
                setIsEditExerciseModalOpen(true);
              }}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl shadow-sm cursor-pointer"
              title="Editar"
            >
              <i className="fas fa-edit text-sm"></i>
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteExercise(exercise.id);
              }}
              className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl shadow-sm cursor-pointer"
              title="Deletar"
            >
              <i className="fas fa-trash text-sm"></i>
            </button>
          </div>
        </div>

        <div className="bg-slate-100/50 rounded-xl p-4 flex flex-col items-center mb-4">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Carga Atual</span>
          <span className="text-4xl font-black text-blue-600 tracking-tighter">{exercise.currentWeight} <small className="text-lg">kg</small></span>
          <span className="text-[9px] text-slate-400 mt-2 italic text-center">
            At: {updateDate.toLocaleDateString()} {updateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="space-y-3 mt-auto">
          <a 
            href={exercise.videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 bg-rose-50 text-rose-600 rounded-lg font-bold text-xs hover:bg-rose-100 transition-colors relative z-10"
          >
            <i className="fab fa-youtube"></i> VER REFERÊNCIA
          </a>
          
          <div className="pt-3 border-t border-slate-100 relative z-10">
            <div className="flex gap-2">
              <input 
                type="number" 
                value={weightInput}
                onChange={(e) => setWeightInput(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <button 
                type="button"
                onClick={(e) => {
                   e.stopPropagation();
                   handleUpdateWeight(exercise.id, weightInput);
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200 shrink-0 cursor-pointer"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WeekTracker = () => {
    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());

    return (
      <div className="week-tracker mt-6 bg-white rounded-2xl shadow-lg p-6 border border-slate-100 animate-fade-in transition-all-300">
        <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-3">
          <i className="fas fa-calendar-alt text-blue-500"></i> Controle de Treinos da Semana
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = new Date(sunday);
            day.setDate(sunday.getDate() + i);
            const dateStr = day.toISOString().split('T')[0];
            const profileWeekData = weekData[dateStr]?.[currentProfileId] || { trained: false, exercises: {} };
            const isToday = day.toDateString() === today.toDateString();

            return (
              <div 
                key={dateStr}
                onClick={() => handleToggleDay(dateStr)}
                className={`flex flex-col p-4 rounded-xl border transition-all-300 cursor-pointer min-h-[140px] hover:shadow-md ${
                  profileWeekData.trained ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'
                } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-700 text-sm uppercase tracking-wider">{daysOfWeek[i]}</div>
                    <div className="text-xs text-slate-500">{day.getDate()}/{day.getMonth() + 1}</div>
                  </div>
                  {profileWeekData.trained && <i className="fas fa-check-circle text-emerald-500 text-lg"></i>}
                </div>
                <div className="mt-2 space-y-1 overflow-y-auto max-h-24 pr-1">
                  {Object.keys(exercises).length > 0 ? (
                    (Object.values(exercises) as Exercise[]).map(ex => (
                      <div 
                        key={ex.id} 
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] sm:text-xs transition-colors ${
                          profileWeekData.exercises[ex.id] ? 'bg-emerald-200/50 text-emerald-800' : 'bg-white/50 text-slate-500'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleDayExercise(dateStr, ex.id);
                        }}
                      >
                         <input 
                           type="checkbox" 
                           checked={!!profileWeekData.exercises[ex.id]} 
                           readOnly 
                           className="w-3 h-3 text-emerald-500"
                         />
                         <span className="truncate flex-1 font-medium">{ex.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-400 text-center italic mt-4">Sem exercícios</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 relative">
      <header className="header-animated shadow-xl py-12 mb-8 rounded-b-[40px] relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                <i className="fas fa-dumbbell text-3xl text-white"></i>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase">PowerTrack <span className="text-blue-200">2025</span></h1>
                <p className="text-white/70 text-xs font-bold uppercase tracking-[0.2em]">Controlador de Performance Elite</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-lg p-2 rounded-2xl border border-white/20">
              <select 
                value={currentProfileId}
                onChange={(e) => setCurrentProfileId(e.target.value)}
                className="bg-white px-4 py-2.5 rounded-xl font-bold text-slate-800 outline-none min-w-[180px] shadow-sm text-sm"
              >
                <option value="">Selecionar Perfil</option>
                {(Object.values(profiles) as Profile[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl transition-all border border-white/10"
                title="Gerenciar Perfis"
              >
                <i className="fas fa-users"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-7xl">
        {currentProfile ? (
          <div className="animate-fade-in space-y-8">
            <div className="glass-card rounded-[32px] p-8 flex flex-col lg:flex-row justify-between items-center gap-8 shadow-xl border border-slate-200/60 transition-all-300">
               <div className="flex flex-col md:flex-row items-center gap-8 flex-1 w-full">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-32 h-32 rounded-full border-4 border-blue-500 overflow-hidden bg-slate-100 flex items-center justify-center shadow-2xl relative">
                      {currentProfile.photo ? (
                        <img src={currentProfile.photo} className="w-full h-full object-cover" alt="Perfil" />
                      ) : (
                        <i className="fas fa-user text-5xl text-slate-300"></i>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">
                       Início: {formatDateDisplay(currentProfile.startDate)}
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase mb-1">{currentProfile.name}</h2>
                    <p className="text-slate-500 font-medium mb-4 italic">"{currentProfile.notes || 'Sem objetivos definidos.'}"</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peso Inicial</div>
                        <div className="text-xl font-black text-blue-600">{currentProfile.weightInitial} <small className="text-xs">kg</small></div>
                      </div>
                      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peso Atual</div>
                        <div className="text-xl font-black text-emerald-600">{currentProfile.weightCurrent} <small className="text-xs">kg</small></div>
                      </div>
                      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meta</div>
                        <div className="text-xl font-black text-rose-500">{currentProfile.goalWeight || '--'} <small className="text-xs">kg</small></div>
                      </div>
                      <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100">
                        <div className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Evolução</div>
                        <div className="text-sm font-black text-white truncate">{calculateEvolutionTime(currentProfile.startDate)}</div>
                      </div>
                    </div>
                  </div>
               </div>
               <button 
                 onClick={() => setIsEditProfileModalOpen(true)}
                 className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg shrink-0"
               >
                 <i className="fas fa-user-edit"></i> EDITAR PERFIL
               </button>
            </div>

            <WeekTracker />

            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100">
               <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <i className="fas fa-dumbbell text-blue-500"></i> Meus Exercícios
                  </h2>
                  <button 
                    onClick={() => setIsAddExerciseModalOpen(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    <i className="fas fa-plus-circle"></i> ADICIONAR EXERCÍCIO
                  </button>
               </div>

               {Object.keys(exercises).length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {(Object.values(exercises) as Exercise[]).sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name)).map(ex => (
                      <ExerciseCard key={ex.id} exercise={ex} />
                    ))}
                 </div>
               ) : (
                 <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl group hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setIsAddExerciseModalOpen(true)}>
                    <i className="fas fa-dumbbell text-6xl text-slate-200 mb-4 group-hover:text-blue-100 transition-colors"></i>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhum exercício. Clique para adicionar.</p>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 animate-fade-in">
             <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-500 text-4xl mx-auto mb-6">
                <i className="fas fa-exclamation-circle"></i>
             </div>
             <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Bem-vindo ao PowerTrack</h2>
             <p className="text-slate-500 font-medium mb-8">Para começar sua jornada, crie seu primeiro perfil de treinamento.</p>
             <button 
               onClick={() => setIsProfileModalOpen(true)}
               className="px-10 py-5 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 uppercase tracking-widest text-lg"
             >
               CRIAR PRIMEIRO PERFIL
             </button>
          </div>
        )}
      </main>

      <footer className="mt-20 py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border-t border-slate-100">
        <div className="container mx-auto px-6">
          <p>Sistema de Controle de Treinos PowerTrack &copy; 2025</p>
          <p className="mt-2 opacity-60">Dados locais armazenados no navegador</p>
          
          <div className="mt-6 flex justify-center gap-4">
             <button 
               onClick={handleBackup} 
               className="text-[10px] px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 opacity-50 hover:opacity-100"
               title="Backup Local (JSON)"
             >
                <i className="fas fa-download"></i> BACKUP
             </button>
             <label 
               className="text-[10px] px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 opacity-50 hover:opacity-100 cursor-pointer"
               title="Restaurar Backup"
             >
                <i className="fas fa-upload"></i> RESTAURAR
                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
             </label>
          </div>
        </div>
      </footer>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal p-4" onClick={() => setIsProfileModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Gerenciar Perfis</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>

            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const photoFile = formData.get('photo') as File;
              let photoBase64 = null;
              if (photoFile && photoFile.size > 0) {
                photoBase64 = await fileToBase64(photoFile);
              }

              const profileId = 'profile_' + Date.now();
              const profile: Profile = {
                id: profileId,
                name: formData.get('name') as string,
                startDate: formData.get('startDate') as string,
                weightInitial: parseFloat(formData.get('weightInitial') as string) || 0,
                weightCurrent: parseFloat(formData.get('weightInitial') as string) || 0,
                goalWeight: formData.get('goalWeight') ? parseFloat(formData.get('goalWeight') as string) : null,
                photo: photoBase64,
                notes: formData.get('notes') as string,
                exercises: {},
                createdAt: new Date().toISOString()
              };
              
              setProfiles(prev => ({ ...prev, [profileId]: profile }));
              setCurrentProfileId(profileId);
              setIsProfileModalOpen(false);
              showNotification('Perfil criado!');
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome</label>
                    <input name="name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Ex: João Musculação" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Foto do Perfil</label>
                    <input name="photo" type="file" accept="image/*" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none text-xs" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Data Início</label>
                    <input name="startDate" type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Peso Inicial (kg)</label>
                    <input name="weightInitial" type="number" step="0.1" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="0.0" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Meta (kg)</label>
                    <input name="goalWeight" type="number" step="0.1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Opcional" />
                 </div>
                 <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Notas/Objetivo</label>
                    <input name="notes" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Ex: Hipertrofia total" />
                 </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg uppercase tracking-widest">
                Criar Perfil
              </button>
            </form>

            <div className="mt-10">
              <h4 className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-4">Perfis Existentes</h4>
              <div className="space-y-3">
                {(Object.values(profiles) as Profile[]).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-white flex items-center justify-center text-blue-500 font-bold shrink-0">
                        {p.photo ? <img src={p.photo} className="w-full h-full object-cover" /> : p.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{Object.keys(p.exercises).length} exercícios • {p.weightCurrent} kg</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setCurrentProfileId(p.id); setIsProfileModalOpen(false); }}
                        className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${currentProfileId === p.id ? 'bg-blue-500 text-white' : 'bg-white text-blue-500 border border-blue-500'}`}
                      >
                        {currentProfileId === p.id ? 'Atual' : 'Selecionar'}
                      </button>
                      <button onClick={() => handleDeleteProfile(p.id)} className="text-rose-400 hover:text-rose-600 p-2" title="Deletar Perfil"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditProfileModalOpen && currentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal p-4" onClick={() => setIsEditProfileModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Editar Perfil</h3>
              <button onClick={() => setIsEditProfileModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              
              const photoFile = formData.get('photo') as File;
              let photoBase64 = currentProfile.photo;
              if (photoFile && photoFile.size > 0) {
                photoBase64 = await fileToBase64(photoFile);
              }

              setProfiles(prev => {
                const next = { ...prev };
                next[currentProfileId] = {
                  ...currentProfile,
                  name: formData.get('name') as string,
                  startDate: formData.get('startDate') as string,
                  weightInitial: parseFloat(formData.get('weightInitial') as string) || currentProfile.weightInitial,
                  weightCurrent: parseFloat(formData.get('weightCurrent') as string) || currentProfile.weightCurrent,
                  goalWeight: formData.get('goalWeight') ? parseFloat(formData.get('goalWeight') as string) : null,
                  notes: formData.get('notes') as string,
                  photo: photoBase64,
                };
                return next;
              });
              setIsEditProfileModalOpen(false);
              showNotification('Perfil atualizado!');
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome</label>
                  <input name="name" defaultValue={currentProfile.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Foto do Perfil (deixe vazio para manter)</label>
                  <input name="photo" type="file" accept="image/*" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none text-xs" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Data Início</label>
                  <input name="startDate" type="date" defaultValue={currentProfile.startDate} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Peso Inicial (kg)</label>
                  <input name="weightInitial" type="number" step="0.1" defaultValue={currentProfile.weightInitial} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Peso Atual (kg)</label>
                  <input name="weightCurrent" type="number" step="0.1" defaultValue={currentProfile.weightCurrent} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Meta (kg)</label>
                  <input name="goalWeight" type="number" step="0.1" defaultValue={currentProfile.goalWeight || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Opcional" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Notas/Objetivo</label>
                  <input name="notes" defaultValue={currentProfile.notes} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-lg uppercase tracking-widest">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal p-4" onClick={() => setIsAddExerciseModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Adicionar Exercício</h3>
              <button onClick={() => setIsAddExerciseModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>
            <form className="space-y-5" onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const exId = 'ex_' + Date.now();
              const now = new Date().toISOString();
              const exercise: Exercise = {
                id: exId,
                name: formData.get('name') as string,
                videoUrl: formData.get('videoUrl') as string,
                currentWeight: parseFloat(formData.get('weight') as string) || 0,
                dateAdded: now,
                lastUpdated: now
              };
              
              setProfiles(prev => {
                if (!prev[currentProfileId]) return prev;
                const next = { ...prev };
                const profile = { ...next[currentProfileId] };
                profile.exercises = { ...profile.exercises, [exId]: exercise };
                next[currentProfileId] = profile;
                return next;
              });
              
              setIsAddExerciseModalOpen(false);
              showNotification('Exercício salvo!');
            }}>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Nome do Exercício</label>
                <input name="name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" placeholder="Ex: Agachamento Livre" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Link YouTube</label>
                <input name="videoUrl" type="url" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" placeholder="https://youtube.com/..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Peso Inicial (kg)</label>
                <input name="weight" type="number" step="0.5" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" placeholder="0.0" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg uppercase tracking-widest">
                Salvar Exercício
              </button>
            </form>
          </div>
        </div>
      )}

      {isEditExerciseModalOpen && currentProfile && editingExerciseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal p-4" onClick={() => setIsEditExerciseModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Editar Exercício</h3>
              <button onClick={() => setIsEditExerciseModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>
            <form className="space-y-5" onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const exercise = currentProfile.exercises[editingExerciseId];
              
              setProfiles(prev => {
                if (!prev[currentProfileId]) return prev;
                const next = { ...prev };
                const profile = { ...next[currentProfileId] };
                const exMap = { ...profile.exercises };
                exMap[editingExerciseId] = {
                  ...exercise,
                  name: formData.get('name') as string,
                  videoUrl: formData.get('videoUrl') as string,
                  currentWeight: parseFloat(formData.get('weight') as string) || exercise.currentWeight,
                  lastUpdated: new Date().toISOString()
                };
                profile.exercises = exMap;
                next[currentProfileId] = profile;
                return next;
              });
              
              setIsEditExerciseModalOpen(false);
              showNotification('Exercício atualizado!');
            }}>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Nome do Exercício</label>
                <input name="name" defaultValue={currentProfile.exercises[editingExerciseId]?.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Link YouTube</label>
                <input name="videoUrl" type="url" defaultValue={currentProfile.exercises[editingExerciseId]?.videoUrl} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Carga Atual (kg)</label>
                <input name="weight" type="number" step="0.5" defaultValue={currentProfile.exercises[editingExerciseId]?.currentWeight} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg uppercase tracking-widest">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl animate-slide-in flex items-center gap-3 font-bold text-white ${
          notification.type === 'success' ? 'bg-emerald-500' : 
          notification.type === 'error' ? 'bg-rose-500' : 'bg-amber-500'
        }`}>
          <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
          {notification.msg}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
