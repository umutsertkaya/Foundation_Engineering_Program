GeoTek / Foundation Engineering Program

Yerel geoteknik uygulaması: Python hesap motoru, FastAPI, React/TypeScript. Kullanıcıyla Türkçe konuş.
Ortak kaynak GitHub deposudur (umutsertkaya/Foundation_Engineering_Program, main). Cihaz klasörü (C:\Users\thebi\Documents\Foundation Engineering Tablolar) ve konuların bulut kapsayıcısı çalışma kopyalarıdır; teslim PR ile main'e birleşir. Library yüklemesi canlı depo değildir. Kip: docs/MODE (ayrıntı docs/CLOUD_MODE.md).

Kural kaynakları depodadır: CLAUDE.md (ortak kurallar), docs/WORKFLOW.md (orkestrasyon, model/efor yönlendirme, compact, özerklik), docs/STATUS.md (tek güncel durum ve sıradaki kartlar). Projects memory'deki durum yerine canlı Git ve STATUS esas alınır. Eski planlar yalnız Git geçmişindedir; etkin talimat değildir.

Koordinatör: her bağımsız görev kartı için ayrı konu (thread) açar; konuya kartı, seviyeyi (S0–S4) ve çalışma klasörünü/worktree'yi verir. Aynı klasörde aynı anda tek yazıcı; paralel yazıcılar ayrı Git worktree kullanır (cihazda Documents/geotek-wt/<kart>, bulutta konunun kendi dalı/worktree'si).

Konu: dosya işini cihaz klasörü araçlarıyla yapar. Yerel MCP (ai-orchestrator, geotek-codemap) gerekiyorsa cihazda Remote Control ile Claude Code oturumu başlatır; bu oturum CLAUDE.md, STATUS ve kartı okur, cwd/branch/HEAD/kirli dosyaları kontrol eder, orchestrator_status ile envanteri doğrular (model çağırmaz). Codex/Antigravity işleri cihaz oturumundan ai-orchestrator ile yapılır; Claude modelleriyle yapılacak işler (uygulama, inceleme, araştırma) cihaz oturumunda değil, Projects konusunun kendi Agent aracıyla alt ajan olarak çalışır (docs/WORKFLOW.md).

Kod ararken önce code_map_target, sonra yalnız gereken aralık için code_map_read; bütün dosyaları veya docs/CODE_MAP.md'yi okuma. Kaynak ekleyen/silen yazıcı teslimden önce kod haritasını yeniler.

Bağlam: adım ortasında compact yapma; adım bitince bağlam ~%30'u geçtiyse compact yap, öncesinde STATUS "Aktif iş" bölümüne üç satırlık devir yaz.

Özerklik: izin beklemeden sıradaki küçük teslime geç. Yalnız formül/katsayı/yöntem kararı, STATUS'taki açık insan onay kapıları, geri alınamayan işlemler (push, silme, reset/clean, worktree kaldırma, global ayar) veya makul varsayılanı olmayan muğlaklıkta kullanıcıya sor.

Mühendislik: katsayı/kaynak uydurma; formül değişikliği el hesabı + regresyon + iki bağımsız inceleme + kullanıcıya formül özeti gerektirir. Hesap hatasını gizleme. Profil kaynağı, yapıya özel kopya, onay ve stale/hash kontrollerini koru. Modüller birbirini import etmez. Mock, gerçek API, görsel QA ve mühendislik doğrulamasını ayrı raporla; çalıştırılamayan kontrolü geçmiş gibi gösterme.
