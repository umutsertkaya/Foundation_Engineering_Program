# E4 — Katmanlı dayanma yapıları: formüller ve mühendis incelemesi

Bu belge P1 sözleşmesinin 5. bölümünü uygular. Hesap bir metre duvar boyu içindir;
birimler m, kN/m, kNm/m, kPa, kN/m³ ve derecedir. İnceleme düzeltmelerinden sonra
523 test geçmektedir; B=4.60 m, yönetici seismic:bearing regresyonu dahildir
(en büyük bağıl fark 3.6e-15). Eski varsayılan yolun Bishop GS değerleri E4 öncesi
commit'te (17a6da7) hesaplanıp testte sabitlenmiştir ve birebir aynıdır. İki bağımsız
inceleme (Claude Opus, gpt-6-astra) aşağıdaki el hesabını yeniden hesaplamıştır.

## 1. Koordinatlar, profiller ve sanal düzlem

Yapı derinliği z tutulan zeminin duvar arkasındaki yüzeyinden aşağı doğrudur.
Taban z=H, ön zemin z_f=H-D'dir. Kuvvet koordinatlarında başlangıç ön ayak alt
ucudur; x arkaya, y yukarıdır. Dolu geometride D=geometry.embedment geçerlidir.
Katman sınırındaki taban, alt katmana aittir. Profil tabanın altına uzanmalıdır.

Arka profil retained_profile() ile, ön profil ve temel front_profile() ile alınır.
retained_fill yalnız arka tarafta doğal profilin yerine geçer. Ön kazı üstündeki
katmanların ağırlığı ön örtü gerilmesine veya pasif basınca katılmaz.

Konsolda topuk ucundan geçen düşey sanal düzlem kullanılır:

```text
rise = heel * tan(beta)
H_v = H + rise
theta = 0
delta = beta
plane_depth = structure_depth + rise
```

Üst katmanın yeni üst derinliği 0'dır; üst kot ile eski yüzey arasındaki ek toprak
da bu katmandır. Diğer sınırlar ve her YASS derinliği rise kadar ötelenir. Bu işlem
zemin katmanlarını eğime paralel yapmaz; sınırlar yatay kalır. Ağırlık poligonları
gerçek yapı kotlarında kesilir, itki diyagramı sanal düzlemin tepesinden ölçülür.

Ağırlık duvarında gerçek arka yüz kullanılır:

```text
H_v = H
theta = atan(back_offset/H)
delta_i = 2*phi_i/3
x_force = B - y_force*tan(theta)
```

Kaynak: mevcut walls.py/earth_thrust_forces yaklaşımı; Das, Principles of Foundation
Engineering, dayanma duvarları bölümü; P1 §5. delta_i üst sınırı için depo kaynak
kaydı: TBDY 2018 §16.12.2.9. Yapı modelinde ayrıca bir arka yüz delta girdisi yoktur.

## 2. Gerilmeler, statik itki ve tam parçalı doğrusal integral

Katman başına toplam birim ağırlık su üstünde gamma, su altında gamma_sat'tır:

```text
sigma_v(z) = integral( gamma_total(s), s=0..z )
u(z) = gamma_w * max(z-z_water, 0), gamma_w = 9.81
sigma_v_eff(z) = sigma_v(z) - u(z)
```

Temel mekanik kaynak: Terzaghi etkin gerilme ilkesi ve hidrostatik basınç. E4 yeni
bir gamma_sat tahmini yapmaz; SoilLayer'ın mevcut gamma_sat=gamma varsayılanı
varsa o değer kullanılır. Proje mühendisi bu değerleri onaylamalıdır.

Drene aktif itki için her katmanın mevcut coulomb_ka fonksiyonu kullanılır:

```text
R = sqrt[ sin(phi+delta)*sin(phi-beta) /
          (cos(delta+theta)*cos(theta-beta)) ]
K_a = cos(phi-theta)^2 /
      [cos(theta)^2*cos(delta+theta)*(1+R)^2]
K_h = K_a*cos(delta+theta)
p_EH = K_h*sigma_v_eff
p_static = K_h*(sigma_v_eff + q_plane)
p_WA = u
```

Kaynak: Coulomb (1776); depodaki coefficients.py ve trial_wedge ile aynı açı
işaretleri. Yatay, sürtünmesiz düşey düzlemde K_a=tan(45-phi/2)^2.
Katmanlı zeminde K_i katmanın üstündeki BÜTÜN katmanların biriktirdiği gerilmeye
uygulanır. Sınırda K değişimi nedeniyle basınç sıçrayabilir. Bu, P1'in yerel katsayı
yaklaşımıdır; katmanları kesen kritik bir kırılma kamasının tam çözümü değildir.

Coulomb kolunda c' mevcut lateral_pressure davranışı uyarınca ihmal edilir ve uyarı
üretilir. Rankine (palplanş/pasif) kolunda:

```text
K_a = tan(45-phi/2)^2; K_p = tan(45+phi/2)^2
p_active_eff = max(K_a*(sigma_v_eff+q)-2*c'*sqrt(K_a), 0)
p_passive_eff = K_p*(sigma_v_eff+q)+2*c'*sqrt(K_p)
```

Sürşarj birim yatay izdüşüm başına düşey q yüküdür. Eğimli gerçek arka yüzde kama
geometrisinden çıkan düzeltme şöyledir (yeni ampirik katsayı değildir):

```text
q_plane = q / (1 + tan(theta)*tan(beta))
```

Gerekçe: kama alanı / sürşarjın yatay genişliği =
H_v*(1+tan(theta)*tan(beta))/2. theta=0 veya beta=0 ise q_plane=q.
Homojen durumda bu düzeltme, q dahil trial_wedge eşdeğerliğini sağlar.

Her katman sınırı, YASS ve gerilmenin sıfır olduğu kesişim bir düğümdür. Aynı
derinlikteki iki düğüm sıçramanın üst/alt değerlerini taşır. Her [a,b] aralığında:

```text
F = (p_a+p_b)*(b-a)/2
M_depth = (b-a)/6 * [p_a*(2*a+b)+p_b*(a+2*b)]
z_resultant = sum(M_depth)/sum(F)
y_resultant = H_v-z_resultant
```

Bu integral parçalı doğrusal diyagramda analitiktir. LS bileşeni q'lu ve q'suz
hesapların kuvvet VE birinci moment farkıdır; kohezif toplam gerilme kolundaki
çatlak kapanması böylece doğru bölünür. Ayrı katman doğrultuları birleştirilmeden
önce her katman için kendi delta_i+theta açısı kullanılır:

```text
Fx = -F_horizontal
Fy = -F_horizontal*tan(delta_i+theta)
```

Suyun yüzey sürtünmesi sıfırdır; gerçek eğimli arka yüzde su için Fy=-F_WA*tan(theta).
Kuvvetlerin momentleri ön ayak alt ucuna göredir: M=x*Fy-y*Fx.

## 3. Deprem itkisi ve atalet

Depodaki Mononobe–Okabe katsayısı aynen kullanılır:

```text
psi = atan(kh/(1-kv))
R_e = sqrt[ sin(phi+delta)*sin(phi-beta-psi) /
            (cos(delta+theta+psi)*cos(beta-theta)) ]
K_AE = cos(phi-theta-psi)^2 /
       [cos(psi)*cos(theta)^2*cos(delta+theta+psi)*(1+R_e)^2]
K_AE_h = (1-kv)*K_AE*cos(delta+theta)
Delta P_horizontal = integral(p_AE_eff-p_static_eff)
y_EQ = seismic_increment_height*H_v
```

Katsayı her drene katmanda ayrı hesaplanır. phi-beta-psi<0 ise mevcut katsayı
fonksiyonu hata verir; E4 buna uydurma bir katsayı veya homojen kama ikamesi eklemez.
Duvar servisinde seismic_increment_height=0.5'tir; düşük seviyeli motor 0.6 dahil
kullanıcının WallLoads değerini korur. Statik EH ve LS bileşkeleri kendi integral
konumlarında, yalnız deprem ARTIMI belirtilen yüksekliktedir. M-O tanı diyagramının
üçgen şekli, artımın tasarımda H_v/2'ye taşındığını tek başına göstermez; forces esastır.

Kaynak: Okabe (1926), Mononobe & Matsuo (1929); mevcut coefficients.py.
[FHWA GEC-4, FHWA-IF-99-015 §5.10.2.1](https://www.fhwa.dot.gov/engineering/geotech/pubs/if99015.pdf)
bu teorinin hareket edebilen duvar, drenajlı kohezyonsuz dolgu ve yalancı statik
atalet varsayımlarını açıklar. E4'ün katman bazında uygulanması ayrıca bir model
yaklaşımıdır; kaynakta katmanlı dolgu için doğrulanmış genel çözüm olarak sunulmaz.

Duvar servisindeki deprem girdileri mevcut TBDY konvansiyonudur:

```text
kh = 0.4*S_DS/r
kv = 0.5*kh
r_default = TBDY_R[gravity_80sds_mm] = 1.5
Fx_inertia = -kh*W; Fy_vertical_seismic = +kv*W
```

Kaynak: TBDY 2018 Denk.16.22, Tablo16.7 ve §16.12.2.8; depo YAML kaynak kayıtları.
Sürşarjlı kama hesabı, mevcut trial_wedge gibi sürşarjın kama gövde kuvvetine
katıldığı konvansiyonu korur. Topuk üzerindeki sürşarj ağırlığına ayrıca atalet
eklenmez (mevcut temel seviye davranışı).

Duvar servisinde statik durum inputs.gwt_case değerini kullanır. Deprem durumu
daima gwt_case="seismic", yani depth_seismic kullanır; ön ve arka taraftaki ayrı
gwt_front/gwt_retained değerleri de bu senaryodan seçilir. Bu alanlar yoksa profil
YASS'ı, depth_seismic yoksa modelin mevcut depth_insitu varsayılanı geçerlidir.
Aynı seçim dış dengeye, diyagramlara, temel/bant adaptörlerine, global stabiliteye
ve eksik WA katsayısı denetimine uygulanır. Seçilen durumdaki su hidrostatiktir;
hidrodinamik basınç, sıvılaşma ve fazla boşluk suyu basıncı hesabı yoktur.

Deprem YASS'ının altında tutulan veya temel katmanı varsa ve inputs.r=None ise
Türkçe uyarı verilir: TBDY 2018 16.12.2.2 / coefficients.py notuna göre fazla
boşluk suyu basıncı gelişebilen yerlerde r ≤ 1 gerekebilir. Bu bir sıvılaşma
tespiti değildir; varsayılan r değiştirilmez, değerlendirme mühendise aittir.

## 4. Drenajsız katmanlar

layerwise=True seçeneği her katmanın behaviour alanını okur; eski distribution
çağrılarında varsayılan drainage davranışı değiştirilmez:

```text
phi=0; c=s_u; K=1
p_active_total = max(sigma_v+q-2*s_u, 0)
p_passive_total = sigma_v+q+2*s_u
u_separate = 0
```

Kaynak: Rankine toplam gerilme çözümü; mevcut lateral_pressure sözleşmesi.
Toplam gerilmede suyu yatay itkiye ikinci kez eklememek için o katmandaki u
bileşeni sıfırdır; taban kaldırması yine su yüklerinden hesaplanır. Karışık
drenajlı komşu katmanların basınç sıçramaları açıkça korunur. Statik drenajsız
arka katmanlar yalnız yatay yüzey/düşey düzlemde desteklenir. Drenajsız deprem
itkisi için yayınlanmış bir katsayı bu kaynak paketinde uygulanmadığından hesap
açık hata verir; s_u sessizce phi'ya çevrilmez ve deprem etkisi atlanmaz.

Drenajsız tutulan katmanlardaki negatif aktif basınç sıfırlanır. Su dolu çekme
çatlağı modeli veya minimum eşdeğer akışkan basıncı (minimum EFP) uygulanmaz.

Ön zemin z_f=H-D kotunda ve ön YASS z_w<z_f ise serbest suyun toplam-gerilme
sınır yükü q_pond=gamma_w*(z_f-z_w)'dir. E4 ön/pasif adaptörü bu yükü
layerwise=True, total_stress_surcharge=q_pond ile yalnız drenajsız katmanlara
aktarır; varsayılan lateral_pressure çağrısı değişmez. Kullanılan gerilme:

```text
sigma_v_front_total(z) = sigma_v_front(z)-sigma_v_front(z_f)+q_pond
p_passive_total(z) = sigma_v_front_total(z)+2*s_u
```

Örneğin z_f=5, z_w=4 için q_pond=9.81 kPa'dır. Drenajsız zemin aralığında ayrı
yatay u bileşeni sıfırdır; yalnız z_w..z_f serbest su aralığının yatay kuvveti
ayrıca eklenir. Böylece su toplam gerilmede ve ayrı yatay kuvvette iki kez sayılmaz.

## 5. Ağırlıklar, su ve kaldırma

Beton geometrisi mevcut gravity_wall_polygon/cantilever_polygons ile aynıdır.
Topuk zemini her katman kotunda ve YASS'ta yatay poligon şeritlerine ayrılır:

```text
W_piece = polygon_area * (gamma above water, gamma_sat below water)
Fx=0; Fy=-W_piece; (x,y)=polygon_centroid
```

Kaynak: statik denge ve poligon alan/ağırlık merkezi (shoelace) integrali. Su altında
zemin ağırlığında gamma_sat kullanılır; kaldırma ayrıca uygulanır. Dolgu temel
altına veya ön tarafa taşınmaz. include_toe_soil=True ise ön ayak üzerindeki
ağırlık doğal ön profil ve onun YASS'ıyla hesaplanır.

Drene, düşey duvarda her taraftaki su başı h=max(H-z_water,0):

```text
P_water = gamma_w*h^2/2
y_water = h/3
Fx_retained=-P_water; Fx_front=+P_water
u_front_base = gamma_w*max(H-z_water_front,0)
u_retained_base = gamma_w*max(H-z_water_retained,0)
U = B*(u_front_base+u_retained_base)/2
x_U = B*(u_front_base+2*u_retained_base) /
      [3*(u_front_base+u_retained_base)]
```

U yukarı yönlü WA kuvvetidir ve y=0'da uygulanır. İki baş sıfırsa kaldırma kuvveti
eklenmez. Kaynak: hidrostatik basıncın üçgen/trapez integrali; ön/arka başlar
arasında DOĞRUSAL taban dağılımı P1 §1.4'ün varsayımıdır, sızma çözümü değildir.
[USACE EM 1110-2-2502](https://www.publications.usace.army.mil/USACE-Publications/Engineer-Manuals/u43544q/32353032/)
hidrolik dayanma yapılarının başvuru kaynağıdır; burada seçilen doğrusal dağılım
bu yayının her geometri için zorunlu/doğrulanmış çözümü olduğu iddiasını taşımaz.
Ön su pasif direncin açık olmasına bağlı değildir ve passive_reduction ile azaltılmaz.
Toplam gerilme ile temsil edilen ön katmanlarda yatay su ikinci kez eklenmez.

Ağırlık duvarında ön yüz x=a*y, a=(B-back_offset-top_width)/H'dir. Ön su
basıncı gerçek ıslak yüzün normalinde integre edilir; yatay izdüşüm diyagramının
F ve z_resultant değerlerinden:

```text
Fx_front=F; Fy_front=-a*F
y_front=H-z_resultant; x_front=a*y_front
M_front=-(1+a^2)*F*y_front
```

Düşey ön yüzde a=0 olur ve eski yatay kuvvet/konum sonucu korunur. Drenajsız
ön katmanlarda ayrı su diyagramının dışladığı aralıklar bu integralde de dışlanır.

Ön zemin üstündeki serbest su, kaldırma başına ve yatay su kuvvetine dahildir.
Ön ayak üzerinde bu serbest suyun ağırlığı sayılmaz; bu korunumlu bir kabuldür.
Kaldırma momentinin devrilme kontrolündeki yeri WallSettings.uplift_moment ile
seçilir; güvenli varsayılan ve alternatif formüller §6–§7'de verilmiştir.

## 6. Temel, pasif ve dış stabilite

Temel dayanımı tabandaki doğal katmanın onaylı değeridir. Drene ön örtü gerilmesi:

```text
q_front_eff = sigma_v_eff_front(H)-sigma_v_eff_front(H-D)
d_w = z_water_front-H; gamma_sub = gamma_sat-gamma_w
gamma_foundation = gamma_sub                         [d_w <= 0]
gamma_foundation = gamma_sub+(d_w/B)*(gamma-gamma_sub) [0 < d_w < B]
gamma_foundation = gamma                             [d_w >= B]
```

Drenajsız taban katmanında phi=0 ve c=s_u ile TOPLAM gerilme kullanılır:

```text
q_front_total = sigma_v_front(H)-sigma_v_front(H-D)
                + gamma_w*max(H-D-z_water_front,0)
gamma_foundation = gamma_sat, if front GWT <= H; otherwise gamma
V_bearing_total = -sum(Fy excluding Uplift)
FS_bearing = Q_ult/V_bearing_total
```

Gerilmeler front_profile() katmanlarından alınır; sondaki terim ön zemin
üstündeki serbest suyu sınır yükü olarak geri ekler. Nq=1, Ngamma=0'dır.
Taşıma gücünün eğik yük girdisi V ve talep paydası kaldırma düşülmemiş toplam
yükü kullanır. Mevcut kaldırmalı temas eksantrisitesi/B_eff konvansiyonu korunur;
kayma/devrilme ve temas qmax/qmin hesaplarında kaldırma mevcut biçimde etkindir.
Kısmi katsayı hesabında aynı ayrım, tüm olumsuz yükler katsayılandıktan sonra
uygulanır. Drene temel net düşey yükü ve yukarıdaki N_gamma YASS geçişini kullanır.

Örtü gerilmesi formülü kazılmış üst katmanları çıkarır. Yukarıdaki N_gamma
yeraltı suyu geçişi yalnız drene temel ve katmanlı adaptörde uygulanır;
WallSettings.gwt_bearing_correction=True güvenli varsayılandır. False seçilirse
tabanda/üstünde gamma_sub, taban altındaki su için gamma kullanılır (eski davranış).
Geçiş gerçek B genişliğini kullanır, B_eff kullanılmaz; d_w=0 ve d_w=B'de süreklidir.
Drenajsız toplam gerilme hesabında N_gamma=0 olduğundan bu seçenek etkisizdir.
Seçim raporda Assumption olarak kaydedilir. Kaynak etiketi:
"Das, Principles of Foundation Engineering, taşıma gücüne yeraltı suyu etkisi (Durum III)".
Tabanın B altına kadar daha düşük phi', c' veya s_u içeren katmanlar uyarılır;
farklı drenaj türleri doğrudan sayısal karşılaştırılmayıp olası zayıflık uyarısı
alır. Profil B'yi kapsamıyorsa ayrıca uyarı verilir. İki katmanlı taşıma gücü yoktur.

use_passive=True ise lateral_pressure(front_profile,D,top=H-D,state=passive)
kullanılır; sadece zemin bileşeni passive_reduction ile azaltılır ve kaymaya
katılır. ASD'de azaltılmış Pp eklenir; kısmi katsayıda ayrıca kodun pasif katılımı
ve direnç böleni uygulanır. Varsayılan passive_reduction=0.5 için mevcut kaynak
paketinde doğrulanmış normatif değer yoktur; bu bir ayardır, standart katsayısı
olarak etiketlenmez. Kapalıysa pasif sıfırdır ve ön dayanım parametresi istenmez.
Etkin olduğunda raporda şu Assumption kaydı bulunur:
"Pasif azaltma katsayısı = {x} — mühendis seçimi (yayımlanmış kaynak gösterilmedi)";
kaynak etiketi "Kullanıcı girdisi"dir. Katsayı yönetmelik değeri olarak sunulmaz.

Dış denge mevcut ASD motorunu kullanır:

```text
V=-sum(Fy); H_load=-sum(Fx)
M_R_net=-sum(x*Fy); M_O=-sum(y*Fx)
M_U=sum(x*Fy for base uplift WA with Fy>0); M_R=M_R_net+M_U
x_R=(M_R_net-M_O)/V; e=B/2-x_R; B_eff=B-2*abs(e)
FS_overturning=M_R/(M_O+M_U)       [uplift_moment="overturning", varsayılan]
FS_overturning=(M_R-M_U)/M_O       [uplift_moment="resisting"]
R_sliding=V*tan(delta_base)+adhesion*max(B_eff,0)  [drained]
R_sliding=s_u*max(B_eff,0)                     [undrained]
FS_sliding=(R_sliding+reduced_passive)/H_load
```

delta_base verilmemişse mevcut FoundationSoil sözleşmesi gereği phi kullanılır;
BASIC aktarımı delta_base=atan(min(tan(phi),0.6)) yazar (TBDY Tablo16.3).
|e|<=B/6 ise qmax/min=V/B*(1±6|e|/B). B/6<|e|<B/2 ise
qmax=2V/[3(B/2-|e|)], qmin=0. Bileşke taban dışındaysa taşıma gücü sağlanmaz.
V<=0 halinde net basınç kaybı açık hata verir. E4 analyze_wall_layered /
verify_wall_layered adaptörlerinde H_load=-sum(Fx)<=0 ise
"Önden baskın yatay yük: ters yönde kayma/devrilme tahkiki bu sürümde yok"
GeoTekError hatası verilir; sonsuz GS raporlanmaz. Pasif kayma direnci bu etki
toplamına katılmaz. Kısmi katsayılarda tasarım etki grupları da denetlenir.
Kaldırma seçimi yalnız adı Uplift, türü WA, Fy>0 ve y=0 olan kuvveti yeniden
sınıflandırır; deprem düşey ataletini veya yüzeydeki su bileşenlerini değiştirmez.
Temas bileşkesi, eksantrisite ve net düşey yük her iki seçimde aynıdır.
Seçim Türkçe Assumption ile, "Mühendis seçimi; varsayılan güvenli taraf" kaynağıyla
kaydedilir. §11 el hesabında varsayılan 910.62/(323.4829896986029+156.96)≈1.895,
resisting ise (910.62−156.96)/323.4829896986029≈2.330 verir.

Taşıma gücü mevcut bearing_capacity fonksiyonudur (şerit temel):

```text
q_ult = c*Nc*dc*ic + q_front_eff*Nq*dq*iq
        + 0.5*gamma_foundation*B_eff*Ngamma*dg*ig
Q_ult=q_ult*B_eff; FS_bearing=Q_ult/V_bearing
Nq=exp(pi*tan(phi))*tan(45+phi/2)^2; Nc=(Nq-1)/tan(phi)
Ngamma=(Nq-1)*tan(1.4phi) [Meyerhof]
Ngamma=1.5*(Nq-1)*tan(phi) [Hansen]
Ngamma=2*(Nq+1)*tan(phi) [Vesic]
```

Bu gösterimde drene durumda q_front_eff ve net V; drenajsız durumda yukarıdaki
q_front_total ve kaldırma düşülmemiş V_bearing_total kullanılır.

Şerit temel şekil çarpanları 1'dir. k=D/B (D/B<=1), aksi halde atan(D/B).
Vesic/Hansen drene kolda dq=1+2tan(phi)*(1-sin(phi))^2*k, dg=1;
Hansen dc=1+0.4k; Vesic dc=dq-(1-dq)/(Nc*tan(phi)). A=V+B_eff*c/tan(phi)
alınır. Vesic iq=max(0,1-H_load/A)^2, ig=max(0,1-H_load/A)^3,
ic=iq-(1-iq)/(Nc*tan(phi)). Hansen iq=max(0,1-0.5H_load/A)^5,
ig=max(0,1-0.7H_load/A)^5, ic=iq-(1-iq)/(Nq-1).
Meyerhof dc=1+0.2sqrt(Kp)D/B; phi>10 ise dq=dg=1+0.1sqrt(Kp)D/B,
aksi halde 1; iq=ic=(1-atan(H_load/V)/90°)^2, ig=max(0,1-angle/phi)^2.
phi=0 için Nc=5.14,Nq=1,Ngamma=0; Vesic q_ult=5.14su*(1+0.4k)*
(1-2H_load/(B_eff*su*5.14))+q; Hansen q_ult=5.14su*(1+0.4k-i_c_prime)+q,
i_c_prime=0.5-0.5sqrt(1-H_load/(B_eff*su)); H_load>B_eff*su ise hata.
Kaynak: Bowles, Foundation Analysis and Design, 5. baskı, Tablo4-1/4-5;
Meyerhof (1963), Hansen (1970), Vesic (1973/1975). E4 mevcut formülleri değiştirmez.

## 7. Kısmi katsayılar ve eksik katsayılar

Her kombinasyonda tan(phi_d)=tan(phi_k)/gamma_phi,
c_d=c_k/gamma_c, su_d=su_k/gamma_su; delta_base de tanjant üzerinden azaltılır.
Zemin itkisi ve pasif direnç bu tasarım değerleriyle yeniden hesaplanır.
Ağırlıkların birim hacim ağırlığı karakteristiktir; DC/EV etkileri yük katsayısıyla
çarpılır. Mevcut kod gibi material.gamma bir değiştirici olarak uygulanmaz.
Kayma/eksantrisite dengeleyici, taşıma gücü tüm olumsuz yük grubunu kullanır.

```text
ODF_sliding = [R_base/gamma_R_sliding
              + participation*Pp_reduced/gamma_R_passive] / H_d
ODF_bearing = Q_ult_d/(gamma_R_bearing*V_d)
ODF_overturning = M_R_d/[gamma_R_overturning*(M_O_d+M_U_d)] [varsayılan, TBDY]
ODF_overturning = (M_R_d-M_U_d)/(gamma_R_overturning*M_O_d) [resisting, TBDY]
```

EC7 EQU için kendi malzeme ve G_stb/G_dst/Q_stb/Q_dst katsayılarıyla devrilme
ayrıca hesaplanır. LRFD direnç katsayısı phi, bölen 1/phi olarak temsil edilir.
EQU'da aynı kullanıcı seçimi kullanılır: varsayılan M_R_d/(M_O_d+M_U_d),
alternatif (M_R_d−M_U_d)/M_O_d. M_U_d, açık WA katsayısı uygulanmış kaldırma
momentidir; temas bileşkesi hesabı bu yeniden sınıflandırmadan etkilenmez.
Katsayı kaynak ve durum etiketleri mevcut YAML + kullanıcı override kayıtlarıdır;
E4 sayısal katsayı üretmez. Bilinmeyen veya eşleştirilmemiş yük türü hata verir.

WA, EH'den ayrıdır. Kısmi katsayıda arka/ön su ve kaldırmaya aynı açık WA katsayısı
uygulanır; elverişli/elverişsiz suyu ayrı katsayılama bu arayüzün kapsamı dışındadır.
Mevcut YAML'larda ayrı WA kaydı yoktur. Eski kuru duvarların required_inputs testi
değişmesin diye E4 hesap sırasındaki KOD KOPYASINA eksik yol kaydı ekler:

```text
EC7/TBDY: <combination>.load.WA
LRFD: load.WA.strength_I; load.WA.extreme_I
```

Kaynak etiketi not_in_source, değer eksiktir; LRFD şeması null kabul etmediği için
orada eksik anahtar aynı eksik değer anlamındadır. Kullanıcı değeri gelince
FactorOverride/FactorLog üzerinden status=user kaydı oluşturulur. Kaynak durumu
mevcut doğrulanmış PAKETTE değer bulunmadığını belirtir; tüm standardın WA hakkında
hiç hüküm içermediği iddiası değildir. Kod dosyaları veya config/codes.py değişmez.
required_factors tüm eksikleri listeler; işlem MissingFactorsError(missing) ile
durur. ASD'de global GS uygulanır; WA dahil hiçbir yüke kısmi katsayı uygulanmaz.
Palplanşta kullanılmayan EQU birleşiminin katsayıları istenmez.

## 8. Global stabilite

bands_from_structure tutulan profilin taban üstü bantlarını ve doğal profilin
taban altı bantlarını verir; band_top=H-layer_top. Tutulan bant ağırlıkları kendi
seçilen YASS'ında, temel bant ağırlıkları ise Bishop modelindeki aynı yüksek su
zarfında z_water=min(z_front,z_retained), y_water=H-z_water olacak biçimde
gamma/gamma_sat olarak bölünür. YASS z=0 ise eğimli yüzeyin z=0 üstündeki
kısmında kuru ağırlığı korumak için sıfır kalınlıklı bir üst bant işareti tutulur.
Duvar ve taşıdığı zemin yükü, toplam kuvvet ve
x ağırlık merkezini koruyarak taban izine yayılır. e_W=B/2-x_W için |e_W|<=B/6
olduğunda q_toe/heel=W/B*(1±6e_W/B); aksi halde uzunluk=3*(B/2-|e_W|),
tepe basınç=2W/uzunluk olan üçgen yük kullanılır. Toprak itkisi kayma kütlesinin
iç kuvvetidir, ayrıca eklenmez.

```text
m_alpha=cos(alpha)+sin(alpha)*tan(phi)/F
F=sum[(c*b+max(W-u*b,0)*tan(phi))/m_alpha] /
  [sum(W*sin(alpha))+sum(kh*W*(yc-yg))/R]
```

Kaynak: Bishop (1955), The use of the slip circle in the stability analysis of
slopes; mevcut stability.py. Arama: x_c=-H..B+H, y_c=0.5H..3H,
tanjant kotu=-2H..-0.05; 12×12×12 tarama, 40 dilim ve mevcut yerel iyileştirme.
Varsayılan yük katsayıları 1.0 ve retained_bands=None olduğunda eski global
model ve dondurulmuş Bishop sonuçları korunur.

Kayma modelinin tek su kotu vardır: y_water=H-min(z_water_front,z_water_retained).
Bu yüksek su zarfı bir sızma çözümü değildir. Bantlar yataydır; ön tarafta taban
üstündeki ince zemin şeridi de tutulan taraf bantlarıyla temsil edilir. Ön ayak
ağırlığı seçeneğinin global bant yaklaşımı da böyledir; dış stabilitede ise doğal
ön profil kullanılır. Ayrı iki boyutlu zemin bölgeleri bu pakette yoktur. Son bant
sonsuz uzar; dairelerin sonlu profilin altında zayıf bir katman olasılığını
dışladığı söylenemez. Kısmi katsayıda tasarım dayanımlarıyla F hesaplanır ve
F/gamma_R_global >= 1 aranır. Sürşarj yüzey yükü kombinasyonun elverişsiz
γ_Q (LS) katsayısıyla; taban izine aktarılan beton ve taşınan zemin ağırlıkları
ayrı elverişsiz γ_G (DC/EV) katsayılarıyla çarpılır. Farklı DC/EV katsayılarında
tasarım ağırlık merkezi yeniden hesaplanır. Aynı kombinasyon/FactorLog yolları
kullanılır: EC7/TBDY <kombinasyon>.load.Q_unfav ve .G_unfav; LRFD
load.LS.strength_I/extreme_I, load.DC.max, load.EV.max. Kullanılan katsayılar
sonuçta kaydedilir; eksikler required_factors / MissingFactorsError ile bildirilir.
ASD'de yük katsayıları 1.0'dır.

Kayma kütlesindeki zemin öz ağırlığı karakteristik kalır (EC7 DA1-C2/DA3'te
geoteknik kalıcı etkiler için 1.0). DA1-C1/DA2 zemin öz ağırlığı katsayılaması
uygulanmaz; bu nedenle bu yaklaşımlarda tam bir faktörlü zemin ağırlığı çözümü
iddia edilmez. k_v kayma dilimlerine uygulanmaz. Bu sınırlar raporda Assumption
olarak yer alır. Taban izindeki taşınan zemin EV yükü bu öz ağırlık sınırından ayrıdır.

## 9. Palplanş yapı servisi

Aktif taraf retained_profile(), pasif taraf front_profile() ile ve top=H kazı
kotundan hesaplanır. Bağımsız ön/arka YASS ve dolgu altında kalan doğal katmanlar
korunur. Rankine/kohezyon/toplam gerilme kuralları §2/§4'teki gibidir.

```text
p_net = gamma_EH*p_active(q=0)
        + gamma_LS*[p_active(q)-p_active(q=0)]
        - p_passive/R_passive + gamma_WA*(u_retained-u_front)
```

Düğüm sıçramalarının iki tarafı ve 0.002 m aralıklarla sayısal integrasyon yapılır.
Konsolda toe=H+D0 için integral(p_net*(toe-z),0..toe)=0 çözülür; Blum
D=1.2D0 ve uç karşı kuvveti integral(p_net) olur. Tek ankrajda
integral(p_net*(z-z_anchor),0..toe)=0 çözülür; T=integral(p_net)>0 ve D=D0'dır.
Kesme integral(p_net), moment integral(kesme) ile alınır;
W_required_cm3=1000*Mmax_kNm/allowable_stress_MPa. Bu nümerik integrasyon ve kök
rutinleri mevcut sheet_pile.py'den kullanılır; analitik 1e-6 doğruluk iddiası yoktur.
Kaynak: mevcut Blum/serbest zemin desteği uygulaması; USS Steel Sheet Piling Design
Manual ve USACE EM 1110-2-2504 (mevcut kaynak etiketi doğrulama sınırı korunur).

Deprem varsa r=1; katmanlı M-O artımının toplamı H boyunca düzgün yayılır (H/2
bileşke); pasif her katmanda min[1,(1-kv)*K_PE/K_P] ile azaltılır. Drenajsız deprem
basıncı durdurulur. Temel palplanş servisi mevcut konvansiyonla statik pasif GS'yi
(ASD dosyasında 1.5) depremli basınçlara da uygular; ileri seviye kombinasyon
zarfı maksimum D, M ve ankraj kuvvetlerini ayrı ayrı verir. Bu servis kazı tabanı
altındaki su seviyesinde etkin olan tüm diyagram için WA isteyebilir; ilk tahmini
gömülmeye göre su katsayısı istemekten vazgeçmez.

## 10. Sizing, rapor verisi ve hash

Temel duvar seviyesi ASD + Vesic, pasif kapalı, ön ayak zemini kapalı, sürşarj
dengeleyici değil, TBDY deprem konvansiyonudur. Temel sürtünmesi yapı kopyasındaki
onaylı delta_base değerinden gelir. soil_from_basic ise eski temel sürtünmesini
açıkça yazar. Su/katman bilgisi temel yapı servisinde de korunur.

```text
D_default=max(0.6,ceil_to_0.05(H/10))
B_start=max(ceil_to_0.05(0.3H),0.9); step=0.05; B_max=1.2H
```

P1'deki ceil gösterimi mevcut size_wall içindeki _ceil fonksiyonudur; tam metreye
yuvarlama değildir. Bu nedenle H=5 için D=0.6 ve ön örtü 19*0.6=11.4 kPa'dır.
Kesit proportion_for ile kurulur; dış kontroller geçince global stabilite denenir.
Yönetici, bir önceki genişlikte ilk sağlanmayan kontroldür. Kontrol servisi girilmiş
geometriyi değiştirmez. Hiçbir servis proje/zemin/geometry/result_hash alanını
yerinde değiştirmez; Cancelled dahil geri çağırım hatası olduğu gibi yayılır.

StructureWallResult, BasicWallResult'a pressures ve result_hash ekler. pressures
anahtarları örneğin static:retained, seismic:front, static:DA1-C2:retained'dır;
retained_static ve retained_soil ara diyagramları da bulunur. front diyagramı ön
zeminden tabana kadar; front_water ise serbest suyu da içeren tam ön su sütunudur
ve tutulan tarafın z=0 kotundan ölçülür. Diyagramlar ilgili
kombinasyonun tasarım dayanımlarıyla, YÜK katsayıları uygulanmadan sunulur.

```text
payload={structure: structure JSON without top-level result_hash,
         design_code: effective code id,
         design_overrides: project's overrides for that code only}
hash=SHA256(UTF8(JSON(payload, sorted keys, no insignificant spaces,
                      ensure_ascii=False, no NaN)))
```

Kaynak: P1 §1.6; SHA-256 bir mühendislik katsayısı değildir. Parmak izi çağrının
aldığı girdiye aittir; size sonrası geometry=None girdisinin hash'i, geometriyi
sonradan yapıya yazan çağıranın yeni girdisiyle farklı olur. Geometriyi yazdıktan
sonra check_structure ile yeni girdiye bağlı sonuç alınmalıdır. Kullanıcı/proje
override'ı çakışırsa yapıdaki settings.factor_overrides önceliklidir; ikisi de
parmak izinde yer alır. Başka kodların proje override'ları hash'i değiştirmez.

## 11. İki katman + su el hesabı (test beklentisi)

H=6 m, B=4 m, D=1 m, beta=theta=delta=0, q=0. Konsolda taban 0.6 m,
gövde yüksekliği 5.4 m, ön ayak 1 m, gövde alt/üst 0.4/0.3 m, topuk 2.6 m.
Ön/doğal temel: phi=30°, gamma=19, YASS=100 m. Arkada üst katman 0..2 m:
phi=30°, gamma=18, gamma_sat=20; alt katman 2..6 m: phi=20°, gamma=19,
gamma_sat=21. Arka YASS z=3 m. K1=1/3; K2=0.4902905965657021.

| z (m) | sigma_v_eff | u | p_eff | p_total |
|---|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 |
| 2 üst | 36 | 0 | 12 | 12 |
| 2 alt | 36 | 0 | 17.650461476365273 | 17.650461476365273 |
| 3 | 55 | 0 | 26.965982811113612 | 26.965982811113612 |
| 6 | 88.57 | 29.43 | 43.425038137824230 | 72.855038137824230 |

sigma'_v(6)=18*2+19*1+(21-9.81)*3=88.57 kPa.

| Aralık | F_EH (kN/m) | z_bileşke (m) | y_kol (m) | M_taban (kNm/m) |
|---|---:|---:|---:|---:|
| 0..2 | 12.000000000000 | 1.333333333333333 | 4.666666666666667 | 56.00000000000000 |
| 2..3 | 22.308222143739 | 2.534798534798535 | 3.465201465201465 | 77.30248405852569 |
| 3..6 | 105.586531423407 | 4.616911611060807 | 1.383088388939193 | 146.03550564007708 |

EH=139.8947535671462 kN/m, M_EH=279.3379896986029 kNm/m,
y_EH=1.996772449114950 m. Su üçgeni WA=0.5*9.81*3²=44.145 kN/m,
y_WA=1 m. Toplam yatay kuvvet=184.0397535671462 kN/m,
M_toplam=323.4829896986029 kNm/m, y_toplam=1.757679976356746 m.

Taban ön/arka basıncı 0/29.43 kPa; kaldırma=58.86 kN/m,
x_U=2.666666666666667 m, moment=156.96 kNm/m.
Topuk ağırlıkları 93.6 kN/m (y=5), 49.4 (y=3.5), 131.04 (y=1.8);
toplam 274.04 kN/m (x=2.7), düşey birinci moment 876.772,
dengeleyici moment 739.908 kNm/m. Ön örtü gerilmesi 19 kPa'dır.
verification/test_walls_layered_hand.py bu sayıları mutlak 1e-6 toleransla ister.

## 12. Açık kararlar ve kabul durumu

- Islak kısmi katsayı hesabının WA değeri proje mühendisi ve kaynak notunu bekler.
  TBDY'nin mevcut gamma_Rphi/gamma_Rc/su ve statik yük eksikleri de aynen sürer.
- passive_reduction varsayılanının normatif kaynağı yoktur; etkin kullanımda
  mühendis kararı gerekir. E4 bunu bir yönetmelik değeri olarak sunmaz.
- Drenajsız deprem itkisi, M-O sınırı dışındaki katmanlar, hidrodinamik/sızma,
  iki tabakalı taşıma gücü ve iki boyutlu farklı ön/arka global bölgeleri kapsam dışıdır.
- Kapı 2 öncesi doğrulama: 523 test geçti; 5 m BASIC duvar B=4.60 m ve yönetici seismic:bearing
  korundu; regresyondaki en büyük bağıl fark 3.6e-15'tir.
- İki bağımsız inceleme (Claude Opus, gpt-6-astra) el hesabını yeniden hesapladı.
  Kapı 2 kararıyla kaldırma momenti seçimi, N_gamma YASS geçişi ve global yük
  katsayıları §6–§8 uyarınca eklendi; bu değişikliklerin testleri yerelde yeniden çalıştırılmalıdır.
