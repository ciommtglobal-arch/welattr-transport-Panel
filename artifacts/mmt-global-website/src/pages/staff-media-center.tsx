import { FormEvent, useEffect, useState, useRef } from "react";
import { UserButton, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Download,
  AlertCircle,
  File as FileIcon
} from "lucide-react";
import {
  getGetMediaItemsQueryKey,
  requestMediaItemDownloadUrl,
  useGetMediaItems,
  useCreateMediaItem,
  useUpdateMediaItem,
  requestMediaUploadUrl,
  type MediaItem,
  type MediaItemStatus,
  type MediaUploadUrlRequestContentType
} from "@workspace/api-client-react";

const statusLabels: Record<MediaItemStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşivlendi",
};

const statusOptions = ["draft", "published", "archived"] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const formatSize = (bytes?: number | null) => {
  if (!bytes) return "Bilinmiyor";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const ALLOWED_CONTENT_TYPES: MediaUploadUrlRequestContentType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "audio/mpeg"
];

export default function StaffMediaCenter() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95 sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/staff/ilanlar"
              className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-foreground/60 transition-colors hover:text-primary sm:inline-flex"
            >
              İlanlar
            </Link>
            {isSignedIn ? <UserButton /> : null}
          </div>
        </div>
      </header>

      {!isLoaded ? (
        <LoadingState />
      ) : !isSignedIn ? (
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <Newspaper className="mb-6 h-12 w-12 text-primary" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            İç İletişim & Medya
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Medya Merkezi</h1>
          <p className="mt-5 leading-relaxed text-foreground/60">
            Medya bültenlerini ve şirket içi dosyaları yönetmek için personel hesabınızla giriş yapın.
          </p>
          <Link
            href="/staff/giris"
            className="mt-8 inline-flex bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Personel Girişi
          </Link>
        </section>
      ) : (
        <MediaInbox />
      )}
    </main>
  );
}

function MediaInbox() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MediaItemStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(debouncedQuery && { query: debouncedQuery }),
    page,
    pageSize: 50,
  };

  const { data: pageData, isLoading, isError, refetch } = useGetMediaItems(params);
  
  const selectedItem = selectedId === "new" 
    ? null 
    : pageData?.items.find((item) => item.id === selectedId) || null;

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            MMT Connect / Operasyon
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl tracking-tight">
            Medya Merkezi
          </h1>
          <p className="mt-4 text-foreground/55 max-w-2xl">
            Özel dosyaları, basın bültenlerini ve şirket içi medya varlıklarını buradan yükleyebilir ve yönetebilirsiniz.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex min-w-[200px] flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Arama
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <input 
                type="text"
                placeholder="Başlık veya özet..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full border border-border bg-card pl-10 pr-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary transition-colors placeholder:text-foreground/30"
              />
            </div>
          </label>
          
          <label className="flex min-w-[160px] flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Durum
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as MediaItemStatus | "all");
                setPage(1);
              }}
              className="h-12 border border-border bg-card px-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary transition-colors"
            >
              <option value="all">Tümü</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSelectedId("new")}
            className="flex h-12 items-center gap-2 bg-primary px-6 text-sm font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Yeni Kayıt
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] items-start">
        {/* List Column */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="border border-destructive/20 bg-destructive/5 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Veriler yüklenemedi</p>
              <button 
                onClick={() => refetch()}
                className="mt-4 text-xs font-semibold uppercase tracking-wider text-destructive hover:underline"
              >
                Tekrar Dene
              </button>
            </div>
          ) : pageData?.items.length === 0 ? (
            <div className="border border-border bg-card px-6 py-16 text-center">
              <FileText className="mx-auto h-10 w-10 text-foreground/20" />
              <h2 className="mt-4 text-lg font-medium">Kayıt Bulunamadı</h2>
              <p className="mt-2 text-sm text-foreground/50">
                Arama kriterlerinize uygun medya kaydı yok.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pageData?.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`flex flex-col gap-3 border p-5 text-left transition-colors ${
                    selectedId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[10px] tracking-wider text-primary px-1.5 py-0.5 bg-primary/10">
                          {item.category}
                        </span>
                        {item.hasFile && (
                          <span className="text-[10px] text-foreground/50 flex items-center gap-1">
                            <FileIcon size={10} /> Dosya
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold leading-snug truncate">{item.title}</h3>
                    </div>
                    <span className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'published' ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' :
                      item.status === 'archived' ? 'border-foreground/20 text-foreground/50 bg-foreground/5' :
                      'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    }`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-foreground/40 mt-1">
                    <span>{formatDate(item.createdAt)}</span>
                    {item.size && <span>{formatSize(item.size)}</span>}
                  </div>
                </button>
              ))}
              
              {pageData && page * pageData.pageSize < pageData.total && (
                <button
                  type="button"
                  onClick={() => setPage(p => p + 1)}
                  className="mt-2 border border-border/70 py-4 text-xs font-semibold uppercase tracking-wider text-foreground/70 hover:bg-foreground/5 transition-colors"
                >
                  Daha Fazla Yükle
                </button>
              )}
            </div>
          )}
        </div>

        {/* Editor Column */}
        <div className="sticky top-28">
          {selectedId === "new" ? (
            <MediaEditor key="new" mode="create" onSave={() => {
              queryClient.invalidateQueries({ queryKey: getGetMediaItemsQueryKey() });
              setSelectedId(null);
            }} onCancel={() => setSelectedId(null)} />
          ) : selectedItem ? (
            <MediaEditor key={selectedItem.id} mode="edit" item={selectedItem} onSave={() => {
              queryClient.invalidateQueries({ queryKey: getGetMediaItemsQueryKey() });
            }} onCancel={() => setSelectedId(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-border/60 bg-card/30 min-h-[400px] text-center px-6">
              <FileIcon className="h-12 w-12 text-foreground/10 mb-4" />
              <p className="text-foreground/50 font-medium">Görüntülemek veya düzenlemek için listeden bir kayıt seçin.</p>
              <button
                type="button"
                onClick={() => setSelectedId("new")}
                className="mt-6 text-sm font-semibold uppercase tracking-wider text-primary hover:underline"
              >
                Veya yeni kayıt oluşturun
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MediaEditor({ 
  mode, 
  item, 
  onSave, 
  onCancel 
}: { 
  mode: "create" | "edit", 
  item?: MediaItem, 
  onSave: () => void,
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [summary, setSummary] = useState(item?.summary || "");
  const [category, setCategory] = useState(item?.category || "");
  const [status, setStatus] = useState<MediaItemStatus>(item?.status || "draft");
  const [sourceUrl, setSourceUrl] = useState(item?.sourceUrl || "");
  
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const createMutation = useCreateMediaItem();
  const updateMutation = useUpdateMediaItem();
  const isPending = createMutation.isPending || updateMutation.isPending || isUploading;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!ALLOWED_CONTENT_TYPES.includes(file.type as any)) {
      setUploadError("Geçersiz dosya formatı. Lütfen PDF, görsel, MP4 veya MP3 yükleyin.");
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB
      setUploadError("Dosya boyutu çok büyük (Maks 50MB).");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
    setUploadedObjectPath(null);
  };

  const uploadSelectedFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // 1. Get presigned URL
      const response = await requestMediaUploadUrl({
        name: selectedFile.name,
        size: selectedFile.size,
        contentType: selectedFile.type as MediaUploadUrlRequestContentType
      });
      
      setUploadProgress(40);
      
      // 2. PUT directly to GCS via presigned URL
      const putResponse = await fetch(response.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });
      
      if (!putResponse.ok) {
        throw new Error("Yükleme işlemi başarısız oldu");
      }
      
      setUploadProgress(100);
      setUploadedObjectPath(response.objectPath);
      return response.objectPath;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu");
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !category.trim()) return;

    let finalObjectPath = uploadedObjectPath;
    
    if (selectedFile && !finalObjectPath) {
      finalObjectPath = await uploadSelectedFile();
      if (!finalObjectPath) return; // Stop if upload failed
    }

    const payload = {
      title,
      summary,
      category,
      status,
      sourceUrl: sourceUrl || null,
      ...(finalObjectPath && selectedFile ? {
        objectPath: finalObjectPath,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        size: selectedFile.size,
      } : {})
    };

    if (mode === "create") {
      createMutation.mutate({ data: payload }, {
        onSuccess: onSave
      });
    } else if (item) {
      updateMutation.mutate({ id: item.id, data: payload }, {
        onSuccess: onSave
      });
    }
  };

  const handleDownload = async () => {
    if (!item?.hasFile) return;
    setIsDownloading(true);
    setDownloadError("");
    try {
      const res = await requestMediaItemDownloadUrl(item.id);
      window.open(res.downloadURL, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError("Dosya adresi alınamadı. Yetkinizi kontrol edin.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
        <h2 className="text-lg font-semibold font-serif">
          {mode === "create" ? "Yeni Medya Ekle" : "Medyayı Düzenle"}
        </h2>
        <button 
          type="button" 
          onClick={onCancel}
          className="text-foreground/40 hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft size={20} className="md:hidden" />
          <span className="hidden md:inline-block text-xs font-semibold uppercase tracking-wider">İptal</span>
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Başlık *
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 border border-input bg-background px-3 focus:border-primary outline-none transition-colors"
              placeholder="Bülten veya dosya adı"
            />
          </label>
          
          <label className="flex flex-col gap-2 text-sm font-medium">
            Kategori *
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 border border-input bg-background px-3 focus:border-primary outline-none transition-colors"
              placeholder="Örn: Basın Bülteni, Rapor, Eğitim"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Özet / Açıklama *
          <textarea
            required
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="resize-y border border-input bg-background p-3 text-sm focus:border-primary outline-none transition-colors"
            placeholder="İçeriğin kısa özeti..."
          />
        </label>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Durum
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaItemStatus)}
              className="h-11 border border-input bg-background px-3 focus:border-primary outline-none transition-colors"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-2 text-sm font-medium">
            Kaynak Bağlantısı (Opsiyonel)
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="h-11 w-full border border-input bg-background pl-10 pr-3 focus:border-primary outline-none transition-colors"
                placeholder="https://"
              />
            </div>
          </label>
        </div>

        <div className="border-t border-border pt-6 mt-2">
          <h3 className="text-sm font-semibold mb-4">Medya Dosyası</h3>
          
          {mode === "edit" && item?.hasFile && !selectedFile && (
            <div className="flex flex-col gap-3 mb-5 p-4 border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <FileIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.fileName || "İsimsiz dosya"}</p>
                    <p className="text-xs text-foreground/60">{formatSize(item.size)} • {item.contentType}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center gap-2 shrink-0 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                >
                  {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  İndir
                </button>
              </div>
              {downloadError && <p className="text-xs text-destructive">{downloadError}</p>}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,image/jpeg,image/png,image/webp,video/mp4,audio/mpeg"
            />
            
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border border-input bg-background px-4 py-2.5 text-sm font-medium hover:border-primary transition-colors"
              >
                <Upload size={16} />
                {selectedFile ? "Dosyayı Değiştir" : (item?.hasFile ? "Yeni Dosya Yükle" : "Dosya Seç")}
              </button>
              
              {selectedFile && (
                <div className="text-sm font-medium flex items-center gap-2 truncate">
                  <FileIcon size={14} className="text-primary shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="text-foreground/50 shrink-0">({formatSize(selectedFile.size)})</span>
                </div>
              )}
            </div>

            {uploadError && (
              <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                <AlertCircle size={14} />
                {uploadError}
              </p>
            )}

            {isUploading && (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-foreground/60">
                  <span>Dosya yükleniyor...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/10 p-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-muted disabled:opacity-50 transition-colors"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-primary px-8 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          {mode === "create" ? "Oluştur" : "Güncelle"}
        </button>
      </div>
      
      {createMutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive text-right">
          Oluşturma başarısız: {createMutation.error?.data?.error || "Bilinmeyen hata"}
        </p>
      )}
      {updateMutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive text-right">
          Güncelleme başarısız: {updateMutation.error?.data?.error || "Bilinmeyen hata"}
        </p>
      )}
    </form>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center gap-3 text-foreground/60">
      <Loader2 className="animate-spin text-primary" />
      Yükleniyor
    </div>
  );
}
