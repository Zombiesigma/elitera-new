
'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ScreenplayBlock } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FileText, Layout, Hash } from 'lucide-react';

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

const TYPE_CYCLE: ScreenplayBlock['type'][] = ['action', 'character', 'parenthetical', 'transition'];

export const ScreenplayEditor = forwardRef<ScreenplayEditorHandle, ScreenplayEditorProps>(({ initialContent, onChange, onBlockFocus, isReadOnly }, ref) => {
  const [blocks, setBlocks] = useState<ScreenplayBlock[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isInitialized = useRef(false);

  const handleUpdate = (newBlocks: ScreenplayBlock[]) => {
    setBlocks(newBlocks);
    setTimeout(() => onChange(JSON.stringify(newBlocks)), 0);
  };

  useImperativeHandle(ref, () => ({
    setBlockType: (type: ScreenplayBlock['type']) => {
      if (!focusedId) return;
      const updated = blocks.map(b => b.id === focusedId ? { ...b, type } : b);
      handleUpdate(updated);
      if (onBlockFocus) onBlockFocus(type);
    },
    getBlocks: () => blocks
  }), [focusedId, blocks]);

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
            if (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.')) type = 'slugline';
            else if (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && !trimmed.includes('.')) type = 'character';
            return { id: uuidv4(), type, text: trimmed };
        }).filter(b => b.text !== "");
        setBlocks(fallbackBlocks.length > 0 ? fallbackBlocks : [{ id: uuidv4(), type: 'action', text: initialContent }]);
      }
    } catch (e) {
      setBlocks([{ id: uuidv4(), type: 'action', text: initialContent }]);
    }
    isInitialized.current = true;
  }, [initialContent]);

  const updateBlockText = (id: string, text: string, type: ScreenplayBlock['type']) => {
    let finalText = text;
    if (type === 'slugline' || type === 'character' || type === 'transition') {
        finalText = text.toUpperCase();
    }
    const updated = blocks.map(b => b.id === id ? { ...b, text: finalText } : b);
    handleUpdate(updated);
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
    const estSeconds = Math.round((wordCount / 160) * 60);
    const mins = Math.floor(estSeconds / 60);
    const secs = estSeconds % 60;
    return { wordCount, sceneCount, time: `${mins}m ${secs}s` };
  }, [blocks]);

  let sceneCounter = 0;

  return (
    <div className="w-full flex flex-col items-center">
      <div 
        className="w-full max-w-[8.5in] bg-white text-zinc-900 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.15)] min-h-[11in] p-[1in] md:p-[1in] font-mono selection:bg-primary/20 selection:text-primary mx-auto cursor-text border border-zinc-100 relative group/editor"
        style={{ fontSize: '12pt', lineHeight: '1.2' }}
      >
        <div className="flex flex-col">
          {blocks.map((block, idx) => {
            if (block.type === 'slugline') sceneCounter++;
            return (
              <BlockItem 
                key={block.id}
                block={block}
                sceneNumber={block.type === 'slugline' ? sceneCounter : undefined}
                isFocused={focusedId === block.id}
                onFocus={() => handleFocus(block.id, block.type)}
                onChange={(text) => updateBlockText(block.id, text, block.type)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                isReadOnly={isReadOnly}
              />
            );
          })}
        </div>
        
        <div className="mt-32 border-t border-dashed border-zinc-100 pt-8 flex items-center justify-between opacity-20 group-hover/editor:opacity-50 transition-opacity select-none">
            <span className="text-[8pt] font-black uppercase tracking-widest">Elitera Industrial Engine v6.0</span>
            <span className="text-[8pt] font-black uppercase tracking-widest italic">Drafting Masterpiece</span>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] hidden md:flex items-center gap-6 px-8 py-3 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl text-white/60">
          <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest">{stats.sceneCount} Adegan</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">{stats.wordCount} Kata</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-orange-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Est. {stats.time} Layar</span>
          </div>
      </div>
    </div>
  );
});

ScreenplayEditor.displayName = 'ScreenplayEditor';

function BlockItem({ block, sceneNumber, isFocused, onFocus, onChange, onKeyDown, isReadOnly }: { 
  block: ScreenplayBlock; 
  sceneNumber?: number;
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

  const getStyle = () => {
    switch (block.type) {
      case 'slugline': 
        return { 
          marginTop: '2.5rem', 
          marginBottom: '1rem', 
          fontWeight: 'bold', 
          textTransform: 'uppercase' as const,
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          paddingBottom: '0.2rem'
        };
      case 'action': 
        return { marginBottom: '1rem', textAlign: 'left' as const };
      case 'character': 
        return { 
          marginTop: '1.5rem', 
          marginBottom: '0.1rem', 
          marginLeft: '2.2in', 
          marginRight: 'auto',
          width: 'fit-content',
          textTransform: 'uppercase' as const,
          fontWeight: 'bold'
        };
      case 'parenthetical': 
        return { 
          marginBottom: '0.1rem', 
          marginLeft: '1.6in', 
          marginRight: 'auto',
          width: 'fit-content',
          fontStyle: 'italic' as const 
        };
      case 'dialogue': 
        return { marginBottom: '1rem', marginLeft: '1in', marginRight: '1.5in' };
      case 'transition': 
        return { 
          marginTop: '1.5rem', 
          marginBottom: '1.5rem', 
          textAlign: 'right' as const, 
          textTransform: 'uppercase' as const, 
          fontWeight: 'bold'
        };
      default: return {};
    }
  };

  return (
    <div className="relative group/item">
      {sceneNumber && !isReadOnly && (
          <>
            <div className="absolute left-[-0.8in] top-1/2 -translate-y-1/2 text-[10pt] font-bold text-zinc-300 pointer-events-none select-none">
                {sceneNumber}
            </div>
            <div className="absolute right-[-0.8in] top-1/2 -translate-y-1/2 text-[10pt] font-bold text-zinc-300 pointer-events-none select-none">
                {sceneNumber}
            </div>
          </>
      )}
      
      <div 
        ref={inputRef}
        contentEditable={!isReadOnly}
        suppressContentEditableWarning
        className={cn(
          "outline-none transition-all duration-200 border-l-2 border-transparent py-0.5 min-h-[1.2em]",
          !isReadOnly && "focus:border-primary/20 focus:bg-primary/[0.01]",
          block.type === 'parenthetical' && "before:content-['('] after:content-[')']",
          isFocused && "z-10"
        )}
        style={getStyle()}
        onInput={(e) => onChange(e.currentTarget.innerText)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      />
    </div>
  );
}
