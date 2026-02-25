'use client';

import { useState } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, orderBy, deleteDoc, addDoc } from 'firebase/firestore';
import type { Shot } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Trash2, Loader2, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShotListEditorProps {
  bookId: string;
}

const shotTypes = [
  { value: 'WS', label: 'Wide Shot (Suasana)' },
  { value: 'MS', label: 'Medium Shot (Interaksi)' },
  { value: 'CU', label: 'Close Up (Emosi)' },
  { value: 'ECU', label: 'Extreme Close Up (Detail)' },
];

export function ShotListEditor({ bookId }: ShotListEditorProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const shotsQuery = firestore ? query(collection(firestore, 'books', bookId, 'shotList'), orderBy('number', 'asc')) : null;
  const { data: shots, isLoading } = useCollection<Shot>(shotsQuery);

  const handleAddShot = async () => {
    if (!firestore) return;
    const nextNum = shots ? (shots.length + 1).toString() : "1";
    try {
      await addDoc(collection(firestore, 'books', bookId, 'shotList'), {
        number: nextNum,
        scene: "",
        type: "WS",
        angle: "",
        movement: "",
        description: "",
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menambah shot' });
    }
  };

  const handleUpdateShot = async (shotId: string, field: keyof Shot, value: string) => {
    if (!firestore) return;
    try {
      await writeBatch(firestore).update(doc(firestore, 'books', bookId, 'shotList', shotId), { [field]: value }).commit();
    } catch (e) {}
  };

  const handleDeleteShot = async (shotId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'books', bookId, 'shotList', shotId));
    } catch (e) {}
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-600">
                <ListChecks className="h-5 w-5" />
            </div>
            <div>
                <h3 className="text-xl font-headline font-black">Shot List</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Perencanaan Sinematografi</p>
            </div>
        </div>
        <Button onClick={handleAddShot} className="rounded-full gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-500/20 bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Tambah Shot
        </Button>
      </div>

      <div className="rounded-[2rem] border bg-card overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b-2">
                <TableHead className="w-16 px-4 font-black uppercase text-[9px] tracking-widest">Shot #</TableHead>
                <TableHead className="w-20 px-4 font-black uppercase text-[9px] tracking-widest">Scene</TableHead>
                <TableHead className="w-32 px-4 font-black uppercase text-[9px] tracking-widest">Type (Size)</TableHead>
                <TableHead className="w-32 px-4 font-black uppercase text-[9px] tracking-widest">Angle</TableHead>
                <TableHead className="w-32 px-4 font-black uppercase text-[9px] tracking-widest">Movement</TableHead>
                <TableHead className="px-4 font-black uppercase text-[9px] tracking-widest">Description</TableHead>
                <TableHead className="w-12 text-right px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary"/></TableCell></TableRow>
              ) : shots?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center opacity-30 italic font-medium">Shot list masih kosong.</TableCell></TableRow>
              ) : shots?.map((shot) => (
                <TableRow key={shot.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="px-2">
                    <Input 
                        value={shot.number} 
                        onChange={(e) => handleUpdateShot(shot.id, 'number', e.target.value)} 
                        className="h-9 border-none bg-transparent font-bold text-center" 
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <Input 
                        placeholder="1" 
                        value={shot.scene} 
                        onChange={(e) => handleUpdateShot(shot.id, 'scene', e.target.value)} 
                        className="h-9 border-none bg-transparent text-center" 
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" className="w-full h-9 justify-start font-black text-[10px] uppercase tracking-tighter bg-orange-500/5 text-orange-600 hover:bg-orange-500/10">
                                {shot.type || 'Pick Type'}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 h-[50vh]">
                            <SheetHeader className="mb-6">
                                <SheetTitle className="font-headline text-2xl font-black">Pilih Type Shot</SheetTitle>
                            </SheetHeader>
                            <div className="grid grid-cols-1 gap-3">
                                {shotTypes.map(t => (
                                    <Button 
                                        key={t.value} 
                                        variant={shot.type === t.value ? "default" : "outline"} 
                                        className="h-14 rounded-2xl justify-between px-6 font-bold"
                                        onClick={() => handleUpdateShot(shot.id, 'type', t.value)}
                                    >
                                        <span>{t.label}</span>
                                        <span className="text-[10px] font-black uppercase opacity-60">{t.value}</span>
                                    </Button>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                  </TableCell>
                  <TableCell className="px-2">
                    <Input 
                        placeholder="Angle" 
                        value={shot.angle} 
                        onChange={(e) => handleUpdateShot(shot.id, 'angle', e.target.value)} 
                        className="h-9 border-none bg-transparent" 
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <Input 
                        placeholder="Movement" 
                        value={shot.movement} 
                        onChange={(e) => handleUpdateShot(shot.id, 'movement', e.target.value)} 
                        className="h-9 border-none bg-transparent" 
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <Input 
                        placeholder="Deskripsi visual..." 
                        value={shot.description} 
                        onChange={(e) => handleUpdateShot(shot.id, 'description', e.target.value)} 
                        className="h-9 border-none bg-transparent italic" 
                    />
                  </TableCell>
                  <TableCell className="text-right px-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-full" onClick={() => handleDeleteShot(shot.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
