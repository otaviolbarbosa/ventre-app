## Gráfico de Altura Uterina na Caderneta da Gestante

### Origem das curvas

O Ministério da Saúde adotou historicamente como padrão de referência um gráfico de curvas elaborado a partir de dados do **Centro Latino-Americano de Perinatologia (CLAP)**, sendo considerados limites de normalidade o P10 (limite inferior) e P90 (limite superior). Essa curva tem origem em uma amostra de mulheres **uruguaias**, o que gerou críticas por não representar adequadamente a população brasileira.

Pesquisas mostraram que os percentis 10 e 90 do CLAP eram muito discrepantes para gestantes brasileiras: o P10 do CLAP classificava como pequenas apenas 0,3 a 1,7% das brasileiras, enquanto o P90 classificava como grandes 42 a 57% delas.

A partir disso, surgiram estudos brasileiros (Freire et al. 2006, Martinelli et al. 2001, Barini 1997) e, mais recentemente, o padrão internacional que a Caderneta da Gestante 2024 referencia: o **INTERGROWTH-21st**.

---

### Tabela oficial — INTERGROWTH-21st (Papageorghiou et al., BMJ 2016)

O INTERGROWTH-21st foi um estudo prospectivo longitudinal multicêntrico e multiétnico, conduzido entre 2009 e 2014 em oito países (Brasil, China, Índia, Itália, Quênia, Omã, Reino Unido e EUA), com gestantes saudáveis e bem nutridas, acompanhadas desde 9–14 semanas até o parto.

Os gráficos e tabelas de AU do INTERGROWTH-21st estão disponíveis com centis e z-scores, com referência: Papageorghiou AT et al., BMJ 2016, 355:i5662.

Abaixo estão os **valores exatos** da tabela oficial, em centímetros (cm), por semana gestacional:

| Semana | P3 | P5 | **P10** | **P50** | **P90** | P95 | P97 |
|--------|----|----|---------|---------|---------|-----|-----|
| 16 | 13,2 | 13,5 | **14,0** | **15,8** | **17,6** | 18,1 | 18,5 |
| 17 | 14,1 | 14,4 | **14,9** | **16,8** | **18,6** | 19,1 | 19,5 |
| 18 | 15,0 | 15,4 | **15,9** | **17,8** | **19,6** | 20,2 | 20,5 |
| 19 | 16,0 | 16,3 | **16,9** | **18,8** | **20,7** | 21,2 | 21,5 |
| 20 | 16,9 | 17,3 | **17,8** | **19,8** | **21,7** | 22,2 | 22,6 |
| 21 | 17,9 | 18,2 | **18,8** | **20,8** | **22,7** | 23,3 | 23,6 |
| 22 | 18,8 | 19,2 | **19,8** | **21,8** | **23,8** | 24,3 | 24,7 |
| 23 | 19,8 | 20,1 | **20,7** | **22,8** | **24,8** | 25,4 | 25,7 |
| 24 | 20,7 | 21,1 | **21,7** | **23,8** | **25,8** | 26,4 | 26,8 |
| 25 | 21,7 | 22,1 | **22,7** | **24,7** | **26,8** | 27,4 | 27,8 |
| 26 | 22,6 | 23,0 | **23,6** | **25,7** | **27,9** | 28,5 | 28,9 |
| 27 | 23,5 | 23,9 | **24,6** | **26,7** | **28,9** | 29,5 | 29,9 |
| 28 | 24,5 | 24,9 | **25,5** | **27,7** | **29,9** | 30,5 | 30,9 |
| 29 | 25,4 | 25,8 | **26,4** | **28,6** | **30,9** | 31,5 | 31,9 |
| 30 | 26,3 | 26,7 | **27,3** | **29,6** | **31,8** | 32,5 | 32,9 |
| 31 | 27,1 | 27,6 | **28,2** | **30,5** | **32,8** | 33,5 | 33,9 |
| 32 | 28,0 | 28,4 | **29,1** | **31,4** | **33,8** | 34,4 | 34,8 |
| 33 | 28,9 | 29,3 | **30,0** | **32,3** | **34,7** | 35,4 | 35,8 |
| 34 | 29,7 | 30,1 | **30,8** | **33,2** | **35,6** | 36,3 | 36,7 |
| 35 | 30,5 | 30,9 | **31,6** | **34,0** | **36,5** | 37,2 | 37,6 |
| 36 | 31,3 | 31,7 | **32,4** | **34,9** | **37,3** | 38,0 | 38,5 |
| 37 | 32,0 | 32,5 | **33,2** | **35,7** | **38,2** | 38,9 | 39,3 |
| 38 | 32,8 | 33,2 | **33,9** | **36,5** | **39,0** | 39,7 | 40,2 |
| 39 | 33,5 | 33,9 | **34,7** | **37,2** | **39,8** | 40,5 | 41,0 |
| 40 | 34,1 | 34,6 | **35,4** | **38,0** | **40,5** | 41,3 | 41,8 |
| 41* | 34,8 | 35,3 | **36,0** | **38,7** | **41,3** | 42,0 | 42,5 |

*\*41 semanas: dados extrapolados*

Fonte: Papageorghiou AT et al., *BMJ* 2016; 355:i5662 — INTERGROWTH-21st Project.

---

### Como os valores são gerados matematicamente

A equação utilizada para predição da AU no INTERGROWTH-21st é: **AU = 1,082 + 0,966 × semana** (r² = 84,6%), representando o P50 (mediana). Os limites P10 e P90 são obtidos a partir da modelagem com second-degree fractional polynomials em framework multinível.

Na prática, para o P50 você pode usar a fórmula linear. Para P10 e P90, os valores são derivados do desvio-padrão da distribuição ajustada — não é uma fórmula simples, os valores tabelados são os que devem ser usados diretamente.

---

### Observação importante para o produto

A Caderneta da Gestante do Ministério da Saúde (edição 2024) referencia esta tabela. Se a medida estiver dentro das curvas (entre P10 e P90), o crescimento é considerado normal. Se os pontos estiverem acima ou abaixo, há suspeita de crescimento anormal que deve ser confirmada por ultrassonografia.

Para a implementação no seu produto, eu recomendaria usar a tabela do INTERGROWTH-21st acima como fonte canônica (é a mais atual, multicêntrica e referenciada na caderneta 2024), ao invés da curva CLAP original (uruguaia) ou das curvas brasileiras regionais (Freire/Cecatti 2006), que são válidas academicamente mas não são o padrão atual do MS.