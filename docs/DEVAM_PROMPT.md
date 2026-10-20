# Yeni yerel Claude Code oturumu için

Projects konusu bu oturumu Remote Control ile başlattıysa brief zaten verilmiştir. Elle başlatırken şu metni kullan:

```text
Bu depoyu CLAUDE.md kurallarıyla yönet. Önce docs/STATUS.md ("Aktif iş" dahil) ve canlı Git durumunu
kontrol et; sana verilen tek görev kartını oku. docs/WORKFLOW.md'deki yönlendirme tablosuyla işi
seviyelendir ve küçük teslimler halinde ilerle. orchestrator_status ile envanteri doğrula (model çağırma).
Kod konumunu code_map_target ile bul; code_map_read ile yalnız gereken aralığı oku.
Adım ortasında compact yapma; adım bitince bağlam %30'u geçtiyse STATUS'a devir yazıp compact yap.
Test kanıtı ve diff olmadan tamam deme.
```

Bu dosya durum saklamaz; iş sırası değişince yalnız STATUS güncellenir.
