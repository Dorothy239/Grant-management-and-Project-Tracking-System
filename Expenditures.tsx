import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import { useActivityLog } from '@/hooks/useActivityLog';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FolderOpen, Upload, FileText, Image, FileSpreadsheet, File, Download, Trash2, Search, Loader2, HardDrive, Calendar, AlertTriangle, User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface DocRecord {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export default function Documents() {
  const { user, loading } = useAuth();
  const { startup, loading: startupLoading } = useStartup();
  const { logActivity } = useActivityLog();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading]);

  useEffect(() => {
    if (startup) { fetchDocuments(); fetchProfiles(); }
    else if (!startupLoading) setLoadingData(false);
  }, [startup, startupLoading]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    const map: Record<string, string> = {};
    (data || []).forEach((p: any) => { map[p.id] = p.full_name || 'Unknown'; });
    setProfileMap(map);
  };

  const fetchDocuments = async () => {
    if (!startup) return;
    try {
      const { data, error } = await supabase.from('documents').select('*').eq('startup_id', startup.id).order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load documents', variant: 'destructive' });
    } finally {
      setLoadingData(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setUploadName(file.name); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startup || !selectedFile) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${startup.id}/${fileName}`;
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      setUploadProgress(60);
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
      setUploadProgress(80);
      const { data: docData, error: dbError } = await supabase.from('documents').insert({
        startup_id: startup.id,
        name: uploadName,
        file_url: publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        uploaded_by: user.id,
      }).select().single();
      if (dbError) throw dbError;
      setUploadProgress(100);
      toast({ title: 'Uploaded', description: 'Deliverable uploaded successfully' });
      await logActivity(startup.id, 'uploaded document', 'document', docData.id, { name: uploadName });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadName('');
      setUploadProgress(0);
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to upload. Make sure the storage bucket exists.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocRecord) => {
    try {
      const urlParts = doc.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${startup?.id}/${fileName}`;
      await supabase.storage.from('documents').remove([filePath]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Document removed' });
      if (startup) await logActivity(startup.id, 'deleted document', 'document', doc.id, { name: doc.name });
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to delete document', variant: 'destructive' });
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.includes('pdf')) return FileText;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalSize = documents.reduce((s, d) => s + d.file_size, 0);

  if (startupLoading || loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!startup && !startupLoading && !loadingData) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">No Team Assigned</h2>
            <p className="text-muted-foreground">Join a team to upload project deliverables.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Deliverables</h1>
            <p className="text-muted-foreground">Upload and manage project documents</p>
          </div>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Upload className="mr-2 h-4 w-4" />Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Deliverable</DialogTitle><DialogDescription>Upload a project document or deliverable</DialogDescription></DialogHeader>
              <form onSubmit={handleUpload}>
                <div className="space-y-4 py-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors">
                    <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedFile ? <span className="font-medium text-foreground">{selectedFile.name} ({formatFileSize(selectedFile.size)})</span> : 'Choose a file to upload'}
                    </p>
                    <Input type="file" className="max-w-xs mx-auto" onChange={handleFileSelect} required />
                  </div>
                  {uploading && (
                    <div className="space-y-2"><Progress value={uploadProgress} className="h-2" /><p className="text-sm text-center text-muted-foreground">Uploading... {uploadProgress}%</p></div>
                  )}
                  <div className="space-y-2"><Label>Document Name</Label><Input placeholder="Name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} required /></div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!selectedFile || uploading}>{uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6 flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-primary" />
              <div><p className="text-sm text-muted-foreground">Total Documents</p><p className="text-2xl font-bold">{documents.length}</p></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-accent">
            <CardContent className="pt-6 flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-accent" />
              <div><p className="text-sm text-muted-foreground">Storage Used</p><p className="text-2xl font-bold">{formatFileSize(totalSize)}</p></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-info">
            <CardContent className="pt-6 flex items-center gap-3">
              <Calendar className="h-8 w-8 text-info" />
              <div><p className="text-sm text-muted-foreground">Latest Upload</p><p className="text-2xl font-bold">{documents.length > 0 ? new Date(documents[0].created_at).toLocaleDateString() : 'None'}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search documents..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>All Documents</CardTitle><CardDescription>{filteredDocuments.length} file{filteredDocuments.length !== 1 ? 's' : ''}</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Uploaded By</TableHead><TableHead>Uploaded</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No documents found</TableCell></TableRow>
                ) : filteredDocuments.map(doc => {
                  const FileIcon = getFileIcon(doc.file_type);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><FileIcon className="h-5 w-5 text-muted-foreground" /></div><span className="font-medium">{doc.name}</span></div></TableCell>
                      <TableCell><Badge variant="outline">{doc.file_type.split('/')[1] || 'file'}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{profileMap[doc.uploaded_by] || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_url, doc.name)}><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
