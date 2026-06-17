
import fs from 'fs';
const content = fs.readFileSync('src/components/DailyDetail.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes("if (step === 'PLANNING') {"));
const end = lines.findIndex((l, i) => i > start && l.includes("if (step === 'HOURS_OFF') {"));

const newPlanningBlock = `  if (step === 'PLANNING') {
    return (
      <div classname="fixed inset-0 bg-surface z-[110] flex flex-col overflow-y-auto pb-10 font-sans">
        <header classname="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-6 py-4 bg-surface-container-lowest shadow-sm border-b border-outline-variant/10">
          <button onclick="{()" ==""> setStep('VIEW')} className="p-1 hover:bg-surface-container rounded-full transition-colors flex items-center justify-center text-on-surface">
            <chevronleft classname="w-5 h-5"/>
          </button>
          <h1 classname="font-headline font-bold text-lg text-on-surface flex-grow text-center mr-10">Plan your status for the day</h1>
        </header>

        <main classname="pt-24 px-6 max-w-xl mx-auto w-full">
          <div classname="flex items-center justify-between mb-8">
            <button onclick="{()" ==""> onNavigate('prev')}
               className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:bg-surface-container-low transition-colors"
            >
              <chevronleft classname="w-5 h-5 text-on-surface"/>
            </button>
            <div classname="font-headline font-bold text-lg text-on-surface">
              {day.dayName}, {dayNumDisplay} {displayMonth}
            </div>
            <button onclick="{()" ==""> onNavigate('next')}
               className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:bg-surface-container-low transition-colors text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <chevronleft classname="w-5 h-5 rotate-180"/>
            </button>
          </div>

          <h2 classname="text-on-surface-variant text-base font-medium mb-6 px-2">
            {day.isPast ? "Retrofit Work Status for the day" : "Let your team know about your Work Status for the day"}
          </h2>

          <div classname="space-y-3">
             {!day.isPast && (
               <>
                 {!day.isClosed && (
                   <>
                     {day.isOfficeClosed ? (
                       <div classname="bg-orange-500/10 border border-orange-500/20 rounded-[24px] p-6 mb-4 flex gap-4 items-start">
                         <div classname="bg-orange-500/20 p-3 rounded-full shrink-0">
                           <alertcircle classname="w-6 h-6 text-orange-600"/>
                         </div>
                         <div classname="flex-grow pt-1">
                           <p classname="text-sm font-bold text-orange-700 leading-tight">
                             The office is closed and it is not possible to plan an In Office presence
                           </p>
                         </div>
                       </div>
                     ) : (
                       <>
                         {day.bookedCount && day.totalCapacity && day.bookedCount >= day.totalCapacity ? (
                        <div classname="flex flex-col gap-4 mb-4">
                          {/* Waiting List Card */}
                          <button onclick="{()" ==""> handleStatusSelect(WorkStatus.WAITING_LIST)}
                            className={ \`w-full bg-surface-container-lowest border border-outline-variant/10 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md transition-all active:scale-[0.98] group \${day.status === WorkStatus.WAITING_LIST ? 'ring-2 ring-primary/40' : ''}\` }
                          >
                            <div classname="flex gap-4 items-center">
                              <div classname="w-14 h-14 bg-amber-100 rounded-[22px] flex items-center justify-center shrink-0">
                                <span classname="text-3xl">⌛</span>
                              </div>
                              <div>
                                <h3 classname="text-xl font-bold text-on-surface font-headline tracking-tight">Waiting List</h3>
                              </div>
                            </div>
                          </button>

                          {/* No Desk Card */}
                          <button onclick="{()" ==""> handleStatusSelect(WorkStatus.OFFICE_NO_DESK)}
                            className={ \`w-full bg-surface-container-lowest border border-outline-variant/10 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md transition-all active:scale-[0.98] group \${day.status === WorkStatus.OFFICE_NO_DESK ? 'ring-2 ring-primary/40' : ''}\` }
                          >
                            <div classname="flex gap-4 items-center">
                              <div classname="w-14 h-14 bg-blue-100 rounded-[22px] flex items-center justify-center shrink-0">
                                <building2 classname="w-8 h-8 text-blue-600"/>
                              </div>
                              <div>
                                <h3 classname="text-xl font-bold text-on-surface font-headline tracking-tight">In Office / Not using a desk</h3>
                              </div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <statusoption emoji="🏢" label="In Office" color="bg-blue-100 text-blue-600" onclick="{()" ==""> handleStatusSelect(WorkStatus.IN_OFFICE)}
                          showChevron 
                          isActive={day.status === WorkStatus.IN_OFFICE}
                        />
                      )}
                    </>
                  )}
                  <statusoption emoji="🏠" label="Remote Working" color="bg-green-100 text-green-600" onclick="{()" ==""> handleStatusSelect(WorkStatus.REMOTE)}
                    isActive={day.status === WorkStatus.REMOTE}
                  />
                </>
              )}
              <statusoption emoji="✈️" label="On a mission" color="bg-orange-100 text-orange-600" onclick="{()" ==""> handleStatusSelect(WorkStatus.MISSION)}
                isActive={day.status === WorkStatus.MISSION}
              />
              <statusoption emoji="🏖️" label="On Leave" color="bg-fuchsia-100 text-fuchsia-600" onclick="{()" ==""> handleStatusSelect(WorkStatus.LEAVE)}
                isActive={day.status === WorkStatus.LEAVE}
              />
              <statusoption emoji="🤒" label="On a sick day" color="bg-red-100 text-red-600" onclick="{()" ==""> handleStatusSelect(WorkStatus.SICK)}
                isActive={day.status === WorkStatus.SICK}
              />
            </>
          )}
        </div>

           <div classname="mt-12 pt-8 border-t border-outline-variant/20">
             <h2 classname="text-on-surface-variant text-base font-medium mb-4 px-2">
               {day.isPast ? "Retrofit hours off" : "Or take hours off"}
             </h2>
             <button onclick="{()" ==""> setStep('HOURS_OFF')}
               className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-[24px] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
             >
               <div classname="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                 <span classname="text-2xl font-bold text-amber-500">⏱️</span>
               </div>
               <span classname="font-headline font-bold text-lg text-on-surface flex-grow text-left">
                 {day.isPast ? "Retrofit hours off" : "Take hours off"}
               </span>
               <chevronleft classname="w-5 h-5 rotate-180 text-on-surface-variant/70"/>
             </button>
           </div>
        </main>

        <animatepresence>
          {retrofitConfirmation && (
            <>
              <motion.div initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" onclick="{()" ==""> setRetrofitConfirmation(null)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
              />
              <motion.div initial="{{" opacity:="" 0,="" scale:="" 0.9,="" y:="" 20="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" scale:="" 0.9,="" y:="" 20="" }}="" classname="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-sm bg-surface-container-lowest rounded-[32px] p-8 z-[201] shadow-2xl overflow-hidden">
                <div classname="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                  <clock classname="w-8 h-8 text-amber-600"/>
                </div>
                
                <h3 classname="font-headline text-xl font-bold text-on-surface text-center mb-3">Retrofitting status</h3>
                <p classname="font-sans text-sm text-on-surface-variant text-center mb-8 px-2 leading-relaxed">
                  Are you sure you want to retrofit this working status?
                  <span classname="block mt-4 py-3 px-4 bg-surface-container rounded-xl border border-outline-variant/10 text-on-surface/80">
                    <span classname="font-bold text-primary">{statusConfig[retrofitConfirmation]?.label}</span> 
                    <span classname="mx-2 opacity-40">→</span> 
                    <span classname="font-bold opacity-60">{config?.label || 'Pending'}</span>
                  </span>
                </p>

                <div classname="flex flex-col gap-3">
                  <button onclick="{handleConfirmRetrofit}" classname="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all">
                    Confirm
                  </button>
                  <button onclick="{()" ==""> setRetrofitConfirmation(null)}
                    className="w-full bg-surface-container-low text-on-surface-variant font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
`;

lines.splice(start, end - start, newPlanningBlock);
fs.writeFileSync('src/components/DailyDetail.tsx', lines.join('\n'));
