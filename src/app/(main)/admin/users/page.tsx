'use client';

import { useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Loader2, 
  Search, 
  Users, 
  ShieldCheck, 
  Filter, 
  MoreHorizontal, 
  UserCircle,
  ExternalLink,
  Zap
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function UserListPageContent() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const searchParams = useSearchParams();
    const roleFilter = searchParams.get('role');
    const [searchTerm, setSearchTerm] = useState('');

    const usersQuery = useMemo(() => {
        if (!firestore || !currentUser) return null;
        const usersCollection = collection(firestore, 'users');
        if (roleFilter) {
            return query(usersCollection, where('role', '==', roleFilter));
        }
        return usersCollection;
    }, [firestore, currentUser, roleFilter]);

    const { data: allUsers, isLoading } = useCollection<User>(usersQuery);

    const filteredUsers = useMemo(() => {
        if (!allUsers) return [];
        let result = allUsers;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(u => 
                u.displayName.toLowerCase().includes(term) || 
                u.username.toLowerCase().includes(term) || 
                u.email.toLowerCase().includes(term)
            );
        }
        return [...result].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [allUsers, searchTerm]);

    const stats = useMemo(() => {
        if (!allUsers) return { total: 0, admin: 0, penulis: 0, pembaca: 0 };
        return {
            total: allUsers.length,
            admin: allUsers.filter(u => u.role === 'admin').length,
            penulis: allUsers.filter(u => u.role === 'penulis').length,
            pembaca: allUsers.filter(u => u.role === 'pembaca').length,
        };
    }, [allUsers]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-10 pb-20 px-1 overflow-x-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center gap-4 mb-4">
                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-2 shadow-sm shrink-0" asChild>
                            <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Zap className="h-3 w-3 fill-current" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Otoritas</span>
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight leading-none">
                        Daftar <span className="text-primary italic">Pujangga</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-3 font-medium">Monitoring hak akses anggota Elitera.</p>
                </motion.div>

                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input 
                        placeholder="Cari pujangga..." 
                        className="pl-11 h-11 md:h-12 rounded-xl md:rounded-2xl bg-card border-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-sm text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: 'Total', value: stats.total, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/5' },
                    { label: 'Moderator', value: stats.admin, icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500/5' },
                    { label: 'Penulis', value: stats.penulis, icon: ExternalLink, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                    { label: 'Pembaca', value: stats.pembaca, icon: UserCircle, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                ].map((item, i) => (
                    <Card key={i} className="border-none shadow-lg rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm group active:scale-95 transition-all">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-0.5 md:space-y-1">
                                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                                    <p className="text-xl md:text-3xl font-black tracking-tighter">{isLoading ? '...' : item.value}</p>
                                </div>
                                <div className={cn("p-2 md:p-3 rounded-xl md:rounded-2xl shadow-inner", item.bg, item.color)}>
                                    <item.icon className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-card">
                <CardHeader className="p-6 md:p-8 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="font-headline text-xl md:text-2xl font-black tracking-tight">Anggota Aktif</CardTitle>
                        <CardDescription className="font-medium text-xs md:text-sm">Menampilkan {filteredUsers.length} profil.</CardDescription>
                    </div>
                    <Button variant="outline" className="rounded-full font-bold border-2 gap-2 h-9 px-4 text-xs hidden sm:flex">
                        <Filter className="h-4 w-4" /> Filter
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-b-2">
                                    <TableHead className="px-6 h-12 md:h-14 font-black uppercase text-[9px] tracking-widest text-muted-foreground/70 whitespace-nowrap">Identitas Publik</TableHead>
                                    <TableHead className="h-12 md:h-14 font-black uppercase text-[9px] tracking-widest text-muted-foreground/70 whitespace-nowrap">Email</TableHead>
                                    <TableHead className="h-12 md:h-14 font-black uppercase text-[9px] tracking-widest text-muted-foreground/70 whitespace-nowrap">Status</TableHead>
                                    <TableHead className="h-12 md:h-14 font-black uppercase text-[9px] tracking-widest text-muted-foreground/70 text-right px-6 whitespace-nowrap">Kontrol</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Skeleton className="h-10 w-10 rounded-full" />
                                                    <div className="space-y-1.5">
                                                        <Skeleton className="h-3 w-24 rounded-full" />
                                                        <Skeleton className="h-2 w-16 rounded-full" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Skeleton className="h-3 w-32 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                                            <TableCell className="text-right px-6"><Skeleton className="h-8 w-20 rounded-full ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center">
                                            <div className="opacity-20 flex flex-col items-center gap-3">
                                                <Users className="h-12 w-12" />
                                                <p className="font-headline text-xl font-bold">Data Kosong</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filteredUsers.map((user, index) => (
                                            <motion.tr 
                                                key={user.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="hover:bg-muted/30 transition-all border-b last:border-0 group"
                                            >
                                                <TableCell className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <Avatar className="h-10 w-10 border shadow-sm">
                                                                <AvatarImage src={user.photoURL} className="object-cover" />
                                                                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                                                                    {user.displayName.charAt(0)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {user.status === 'online' && (
                                                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card animate-pulse" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-xs group-hover:text-primary transition-colors truncate">{user.displayName}</p>
                                                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">@{user.username}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-[10px] font-bold text-foreground/70 truncate max-w-[100px]">{user.email}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        className={cn(
                                                            "rounded-full px-2 py-0.5 font-black text-[8px] uppercase tracking-tighter shadow-none border-none",
                                                            user.role === 'admin' ? "bg-rose-500 text-white" : 
                                                            user.role === 'penulis' ? "bg-primary text-white" : 
                                                            "bg-muted text-muted-foreground"
                                                        )}
                                                    >
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right px-6">
                                                    <Button variant="outline" size="sm" className="rounded-full font-black text-[9px] h-8 px-3 border-2 hover:bg-primary hover:text-white transition-all whitespace-nowrap" asChild>
                                                        <Link href={`/profile/${user.username.toLowerCase()}`}>
                                                            Profil <ChevronRight className="ml-1 h-2.5 w-2.5" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function UserListPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-32 gap-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground/60">Menghubungkan Otoritas...</p>
        </div>
    }>
        <UserListPageContent />
    </Suspense>
  );
}
