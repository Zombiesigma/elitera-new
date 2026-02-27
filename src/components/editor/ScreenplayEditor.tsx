'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ScreenplayBlock } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Clock, FileText, Hash, Zap, Sparkles, Layout } from 'lucide-react';

interface ScreenplayEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onBlockFocus?: (type: ScreenplayBlock['type']) => void;
  isReadOnly?: boolean;
}

export interface ScreenplayEditorHandle {
  setBlockType: (type: ScreenplayBlock['type']) => void;
  getBlocks: () => ScreenplayBlock[];
}

const TYPE_CYCLE: ScreenplayBlock['type'][] = ['action', 'character', 'parenthetical', 'dialogue', 'transition'];

/**
 * ScreenplayEditor v9.0 - Master Dialogue Edition
 * Optimized for true Hollywood margins and block cohesion.
 */
export const ScreenplayEditor = forwardRef<ScreenplayEditorHandle, ScreenplayEditorProps>(({ initialContent, onChange, onBlockFocus, isReadOnly }, ref) => {
  const [blocks, setBlocks] = useState<ScreenplayBlock[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isInitialized = useRef(false);

  const handleUpdate = useCallback((newBlocks: ScreenplayBlock[]) => {
    setBlocks(newBlocks);
    onChange(JSON.stringify(newBlocks));
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    setBlockType: (type: ScreenplayBlock['type']) => {
      if (!focusedId) return;
      const updated = blocks.map(b => b.id === focusedId ? { ...b, type } : b);
      handleUpdate(updated);
      if (onBlockFocus) onBlockFocus(type);
    },
    getBlocks: () => blocks
  }), [focusedId, blocks, handleUpdate, onBlockFocus]);

  useEffect(() => {
    if (isInitialized.current) return;

    try {
      if (initialContent.trim().startsWith('[') && initialContent.trim().endsWith(']')) {
        const parsed = JSON.parse(initialContent);
        setBlocks(parsed);
      } else if (initialContent.trim() === '') {
        setBlocks([{ id: uuidv4(), type: 'slugline', text: 'INT. LOKASI - WAKTU' }]);
      } else {
        const lines = initialContent.split('\n');
        const fallbackBlocks = lines.map(line => {
            const trimmed = line.trim();
            let type: ScreenplayBlock['type'] = 'action';
            
            if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) type = 'slugline';
            else if (trimmed.startsWith('(')) type = 'parenthetical';
            else if (trimmed === trimmed.toUpperCase() && trimmed.length > 1 && trimmed.length < 35) type = 'character';
            
            return { id: uuidv4(), type, text: trimmed };
        }).filter(b => b.text !== "");
        
        setBlocks(fallbackBlocks.length > 0 ? fallbackBlocks : [{ id: uuidv4(), type: 'action', text: initialContent }]);
      }
    } catch (e) {
      setBlocks([{ id: uuidv4(), type: 'action', text: initialContent }]);
    }
    isInitialized.current = true;
  }, [initialContent]);

  const updateBlockText = (id: string, text: string, currentType: ScreenplayBlock['type']) => {
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return;

    let newType = currentType;
    const trimmed = text.trim();
    const upperText = trimmed.toUpperCase();

    // Auto-pattern detection only for headings and obvious transitions
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|I\.E\.)/i.test(trimmed)) {
        newType = 'slugline';
    } else if (trimmed.startsWith('(') && !trimmed.endsWith(')')) {
        newType = 'parenthetical';
    } else if (/(TO:|IN:|OUT:)$/i.test(trimmed) && trimmed.length < 25) {
        newType = 'transition';
    }

    let finalText = text;
    if (newType === 'slugline' || newType === 'character' || newType === 'transition') {
        finalText = text.toUpperCase();
    }

    const updated = [...blocks];
    updated[index] = { ...updated[index], text: finalText, type: newType };
    handleUpdate(updated);
    
    if (newType !== currentType && onBlockFocus) {
        onBlockFocus(newType);
    }
  };

  const handleFocus = (id: string, type: ScreenplayBlock['type']) => {
    setFocusedId(id);
    if (onBlockFocus) onBlockFocus(type);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (isReadOnly) return;

    const currentBlock = blocks[index];

    if (e.altKey) {
        const keyMap: Record<string, ScreenplayBlock['type']> = {
            '1': 'slugline',
            '2': 'action',
            '3': 'character',
            '4': 'parenthetical',
            '5': 'dialogue',
            '6': 'transition'
        };
        if (keyMap[e.key]) {
            e.preventDefault();
            const updated = blocks.map((b, i) => i === index ? { ...b, type: keyMap[e.key] } : b);
            handleUpdate(updated);
            if (onBlockFocus) onBlockFocus(keyMap[e.key]);
            return;
        }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let nextType: ScreenplayBlock['type'] = 'action';
      
      if (currentBlock.type === 'character') nextType = 'dialogue';
      else if (currentBlock.type === 'parenthetical') nextType = 'dialogue';
      else if (currentBlock.type === 'dialogue') nextType = 'action';
      else if (currentBlock.type === 'slugline') nextType = 'action';
      else if (currentBlock.type === 'action' && currentBlock.text === "") nextType = 'character';

      const newBlock: ScreenplayBlock = { id: uuidv4(), type: nextType, text: '' };
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setFocusedId(newBlock.id);
      handleUpdate(newBlocks);
      if (onBlockFocus) onBlockFocus(nextType);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const currentIndex = TYPE_CYCLE.indexOf(currentBlock.type);
      const nextIndex = (currentIndex + 1) % TYPE_CYCLE.length;
      const nextType = TYPE_CYCLE[nextIndex === -1 ? 0 : nextIndex];
      const updated = blocks.map((b, i) => i === index ? { ...b, type: nextType } : b);
      handleUpdate(updated);
      if (onBlockFocus) onBlockFocus(nextType);
    }

    if (e.key === 'Backspace' && currentBlock.text === '' && blocks.length > 1) {
      e.preventDefault();
      const newBlocks = blocks.filter((_, i) => i !== index);
      const prevBlock = blocks[index - 1];
      if (prevBlock) {
          setFocusedId(prevBlock.id);
          if (onBlockFocus) onBlockFocus(prevBlock.type);
      }
      handleUpdate(newBlocks);
    }
  };

  const stats = useMemo(() => {
    const wordCount = blocks.reduce((acc, b) => acc + b.text.split(/\s+/).filter(Boolean).length, 0);
    const sceneCount = blocks.filter(b => b.type === 'slugline').length;
    const estSeconds = Math.round((wordCount / 180) * 60);
    const mins = Math.floor(estSeconds / 60);
    const secs = estSeconds % 60;
    const pageCount = Math.max(1, Math.ceil(wordCount / 280));
    return { wordCount, sceneCount, time: `${mins}m ${secs}s`, pageCount };
  }, [blocks]);

  let sceneCounter = 0;

  return (
    <div className="w-full flex flex-col items-center pb-32">
      <div 
        className={cn(
          "w-full max-w-[8.5in] bg-white text-zinc-900 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.2)] min-h-[11in] font-mono selection:bg-primary/20 selection:text-primary mx-auto cursor-text border border-zinc-100 relative group/editor",
          "transition-all duration-500",
          "px-6 md:pl-[1.5in] md:pr-[1in] md:py-[1in]"
        )}
        style={{ fontSize: '12pt', lineHeight: '1.2' }}
      >
        <div className="flex flex-col">
          {blocks.map((block, idx) => {
            if (block.type === 'slugline') sceneCounter++;
            
            let isContd = false;
            if (block.type === 'character') {
                const prevDialogueIdx = blocks.slice(0, idx).findLastIndex(b => b.type === 'character');
                if (prevDialogueIdx !== -1) {
                    const prevName = blocks[prevDialogueIdx].text.trim().toUpperCase();
                    const currentName = block.text.trim().toUpperCase();
                    if (prevName === currentName && currentName !== "") {
                        isContd = true;
                    }
                }
            }

            return (
              <BlockItem 
                key={block.id}
                block={block}
                sceneNumber={block.type === 'slugline' ? sceneCounter : undefined}
                isContd={isContd}
                isFocused={focusedId === block.id}
                onFocus={() => handleFocus(block.id, block.type)}
                onChange={(text) => updateBlockText(block.id, text, block.type)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                isReadOnly={isReadOnly}
              />
            );
          })}
        </div>
        
        <div className="mt-40 border-t border-dashed border-zinc-100 pt-10 flex items-center justify-between opacity-30 group-hover/editor:opacity-60 transition-opacity select-none pb-10">
            <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[8pt] font-black uppercase tracking-[0.3em]">Elitera Hollywood Grade Engine v9.0</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-[8pt] font-black uppercase tracking-[0.2em] italic">Industrial Bound Master</span>
                <span className="text-[8pt] font-bold">PAGE {stats.pageCount}</span>
            </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] hidden md:flex items-center gap-8 px-10 py-4 bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white/70 ring-1 ring-white/5">
          <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <Hash className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{stats.sceneCount} SCENES</span>
                <span className="text-[7px] font-bold opacity-50 uppercase">Sequence Count</span>
              </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Layout className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{stats.pageCount} PAGES</span>
                <span className="text-[7px] font-bold opacity-50 uppercase">Production Length</span>
              </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{stats.time}</span>
                <span className="text-[7px] font-bold opacity-50 uppercase">Est. Runtime</span>
              </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Live Sync Active</span>
          </div>
      </div>
    </div>
  );
});

ScreenplayEditor.displayName = 'ScreenplayEditor';

function BlockItem({ block, sceneNumber, isContd, isFocused, onFocus, onChange, onKeyDown, isReadOnly }: { 
  block: ScreenplayBlock; 
  sceneNumber?: number;
  isContd?: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isReadOnly?: boolean;
}) {
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.innerText = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.innerText = block.text;
  }, []);

  useEffect(() => {
    if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
      const s = window.getSelection();
      if (s) {
        const r = document.createRange();
        r.selectNodeContents(inputRef.current);
        r.collapse(false);
        s.removeAllRanges();
        s.addRange(r);
      }
    }
  }, [isFocused]);

  const getClassName = () => {
    switch (block.type) {
      case 'slugline': 
        return "mt-10 mb-4 font-bold uppercase border-b border-black/5 pb-1 tracking-tighter text-[1.1em]";
      case 'action': 
        return "mb-4 text-left leading-[1.2]";
      case 'character': 
        return "mt-6 mb-0.5 font-bold uppercase tracking-wide text-left w-full max-w-[3in] mx-auto pl-[1.2in]";
      case 'parenthetical': 
        return "mb-0.5 italic text-[0.95em] opacity-80 text-left w-full max-w-[2.5in] mx-auto pl-[0.8in]";
      case 'dialogue': 
        return "mb-4 leading-[1.2] text-[1.05em] text-left w-full max-w-[3.5in] mx-auto pl-[0.2in] font-medium";
      case 'transition': 
        return "mt-8 mb-8 text-right font-bold uppercase tracking-[0.2em] text-[0.95em] opacity-60";
      default: return "";
    }
  };

  return (
    <div className="relative group/item">
      {sceneNumber && (
          <>
            <div className="absolute left-[-1.5rem] md:left-[-1.2in] top-1/2 -translate-y-1/2 text-[10pt] font-black text-zinc-200 pointer-events-none select-none tracking-tighter">
                {sceneNumber}.
            </div>
            <div className="absolute right-[-1.5rem] md:right-[-0.8in] top-1/2 -translate-y-1/2 text-[10pt] font-black text-zinc-200 pointer-events-none select-none tracking-tighter">
                {sceneNumber}.
            </div>
          </>
      )}

      {isContd && block.type === 'character' && block.text.trim() && (
          <div className="absolute left-1/2 -translate-x-1/2 top-[-1rem] text-[7pt] font-black text-primary/30 uppercase tracking-widest select-none ml-[0.6in]">
              (CONT'D)
          </div>
      )}
      
      <div 
        ref={inputRef}
        contentEditable={!isReadOnly}
        suppressContentEditableWarning
        className={cn(
          "outline-none transition-all duration-200 border-l-4 border-transparent py-0.5 min-h-[1.2em] whitespace-pre-wrap break-words",
          getClassName(),
          !isReadOnly && "focus:border-primary/20 focus:bg-primary/[0.01]",
          isFocused && "z-10"
        )}
        onInput={(e) => onChange(e.currentTarget.innerText)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      />
    </div>
  );
}
