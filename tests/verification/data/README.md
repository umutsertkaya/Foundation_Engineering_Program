# Doğrulama veri setleri

Bu dosyalar yayımlanmış raporlardaki vaka geçmişi tablolarından metin çıkarımıyla (pypdf)
alınmıştır. Sayısal değerler raporda yazdığı gibidir (yuvarlanmış); kaynak sütunu dışarıda bırakılmıştır.

## bi2014_table3_1_cpt.csv

- Kaynak: Boulanger, R.W. & Idriss, I.M. (2014). *CPT and SPT based liquefaction triggering
  procedures*. Report UCD/CGM-14/01, UC Davis. Tablo 3.1 (I_c < 2.6 olan CPT vakaları).
- URL: https://faculty.engineering.ucdavis.edu/boulanger/wp-content/uploads/sites/71/2014/09/Boulanger_Idriss_CPT_and_SPT_Liq_triggering_CGM-14-01_20141.pdf
- Satır: 233 (raporda 253 vaka var; 20 satır PDF'teki satır kırılmaları nedeniyle ayrıştırılamadı).
- Sütunlar: `M, amax, z, gwt, sv, se, qcN (=q_c/Pa), fsN, F, n, Q, Ic, PI, FC_lab, FC_ic, FC,
  CN, qc1N, dqc1N, qc1Ncs, rd, CSR, Ksigma, MSF, CSR75`.
- Bilinen not: Canterbury 2010–2011 vakalarında `FC_ic` sütunu I_c bağıntısından değil saha
  verisinden (Green et al. 2014) gelir; FC(I_c) testinde hariç tutulur.

## ib2010_table3_1_spt.csv

- Kaynak: Idriss, I.M. & Boulanger, R.W. (2010). *SPT-based liquefaction triggering procedures*.
  Report UCD/CGM-10/02, UC Davis. Tablo 3.1.
- URL: https://faculty.engineering.ucdavis.edu/boulanger/wp-content/uploads/sites/71/2014/09/Idriss_Boulanger_SPT_Liquefaction_CGM-10-02.pdf
- Satır: 226.
- Sütunlar: `M, amax, z, gwt, sv, se, Nm, N1_60, CB, CE, CN, CR, CS, FC, N1_60cs, rd, Ksigma, MSF, CSR, CSR75`.
- B&I 2014 SPT yöntemi C_N, ΔN, r_d ve K_σ bakımından 2010 raporuyla aynıdır; yalnızca MSF
  değişmiştir. Bu tablodaki MSF (2008 bağıntısı) bu yüzden test edilmez.
- Bilinen not: Birkaç satırda tablo değeri raporun kendi denklemiyle tutarsızdır (ör. σ'v > Pa
  iken K_σ = 1.00) ve kayıt istasyonlarındaki vakalarda CSR saha tepki analizinden alınmıştır.
  Testler bu nedenle SPT'de küçük, belgelenmiş bir aykırı oranına izin verir.

## Youd et al. (2001)

Açık erişimli, ara sonuçları tablo halinde veren bir Youd et al. (2001) örnek seti bulunamadı;
bu yöntem şimdilik yalnızca denklem düzeyindeki el hesaplarıyla test edilmektedir
(`tests/unit/test_liquefaction_methods.py`).
