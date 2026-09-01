# -*- coding: utf-8 -*-
"""Budget prévisionnel CAPE Berlin (sans vols) — export PDF pour envoi par mail."""
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

OUT = "Budget_previsionnel_CAPE_Berlin_sans_vols.pdf"
GOLD, BROWN = HexColor("#BF9000"), HexColor("#C55A11")
GREEN, GREEN_L = HexColor("#70AD47"), HexColor("#A9D18E")
BLUE, BLUE_L = HexColor("#2E75B6"), HexColor("#9DC3E6")
RED, GREY = HexColor("#C00000"), HexColor("#595959")

title_s = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=14, alignment=1)
sub_s = ParagraphStyle("s", fontName="Helvetica-Bold", fontSize=11.5, alignment=1, spaceAfter=8)
note_s = ParagraphStyle("n", fontName="Helvetica-Oblique", fontSize=8, textColor=GREY, spaceAfter=4)
cell_s = ParagraphStyle("c", fontName="Helvetica", fontSize=9, leading=11.5)
cell_b = ParagraphStyle("cb", parent=cell_s, fontName="Helvetica-Bold")
cell_w = ParagraphStyle("cw", parent=cell_b, textColor=white, alignment=1)
cell_wr = ParagraphStyle("cwr", parent=cell_w, fontName="Helvetica", fontSize=8.5)

def eur(v): return f"{v:,.2f} €".replace(",", " ").replace(".", ",")

story = [
    Paragraph("Commission d'Aide aux Projets Étudiants (CAPE)", title_s),
    Paragraph("Dossier de demande de financement - Budget prévisionnel — Voyage Berlin (50 personnes, 3 jours)", sub_s),
]

# ===== BUDGET COMMUNICATION =====
story.append(Table([[Paragraph("BUDGET COMMUNICATION", cell_w)]], colWidths=[24.5*cm],
                   style=TableStyle([("BACKGROUND", (0,0), (-1,-1), GOLD),
                                     ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)])))
story.append(Spacer(1, 2))
story.append(Paragraph("Chiffrez les actions et supports (décrits dans votre plan de communication à joindre au dossier) utilisés pour promouvoir le projet", note_s))
comm = Table([
    [Paragraph("Type de supports de communication (papier et numérique)", cell_wr),
     Paragraph("Montant", cell_wr), Paragraph("Numéro de devis", cell_wr)],
    [Paragraph("60 books", cell_s), Paragraph(eur(20.04), ParagraphStyle("r", parent=cell_s, alignment=2)),
     Paragraph("1", ParagraphStyle("cc", parent=cell_s, alignment=1))],
    [Paragraph("Total de la communication (reporté dans le budget ci-dessous)", ParagraphStyle("tw", parent=cell_b, textColor=white)),
     Paragraph(eur(20.04), ParagraphStyle("twr", parent=cell_b, textColor=white, alignment=2)), ""],
], colWidths=[18.5*cm, 3.5*cm, 2.5*cm], style=TableStyle([
    ("BACKGROUND", (0,0), (-1,0), BROWN), ("BACKGROUND", (0,2), (-1,2), BROWN),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#B0B0B0")),
    ("SPAN", (2,2), (2,2)),
    ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
]))
story.append(comm)
story.append(Spacer(1, 10))

# ===== BUDGET GLOBAL =====
story.append(Table([[Paragraph("BUDGET GLOBAL", cell_w)]], colWidths=[24.5*cm],
                   style=TableStyle([("BACKGROUND", (0,0), (-1,-1), GOLD),
                                     ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)])))
story.append(Spacer(1, 2))
story.append(Paragraph("Impérativement équilibré : total recettes = total dépenses. Joindre l'ensemble des devis correspondants.", note_s))

r = ParagraphStyle("r", parent=cell_s, alignment=2)
c = ParagraphStyle("c1", parent=cell_s, alignment=1)
dep_rows = [
    ("Communication", 20.04, 1),
    ("Logement (auberge de jeunesse 50p, 3 nuits)", 4500.00, 2),
    ("Île aux Musées (50p)", 1200.00, 4),
    ("Transport en commun sur place (50p)", 1059.00, 3),
    ("DDR Museum (50p)", 450.00, 5),
    ("Croisière sur la Spree (50p)", 900.00, 6),
    ("", None, None),
]
rec_rows = [
    ("Subvention demandée à la CAPE", 1129.04, "/", True),
    ("CROUS", None, "", False),
    ("Fonds propres", None, "", False),
    ("Plateformes participatives", None, "", False),
    ("Sponsoring", None, "", False),
    ("Subvention collectivités territoriales", None, "", False),
    ("Ventes voyage", 7000.00, "", False),
]
hdr = [Paragraph("DÉPENSES PRÉVISIONNELLES", cell_w), "", "",
       Paragraph("RECETTES PRÉVISIONNELLES", cell_w), "", ""]
sub = [Paragraph("Type de dépenses", cell_wr), Paragraph("Montant", cell_wr), Paragraph("Numéro de devis", cell_wr),
       Paragraph("Type de recettes", cell_wr), Paragraph("Montant", cell_wr), Paragraph("Acquis / Non Acquis", cell_wr)]
data = [hdr, sub]
red_s = ParagraphStyle("red", parent=cell_b, textColor=RED)
red_r = ParagraphStyle("redr", parent=red_s, alignment=2)
for i in range(7):
    dl, dm, dd = dep_rows[i]
    rl, rm, ra, is_red = rec_rows[i]
    ls = red_s if is_red else cell_s
    rs = red_r if is_red else r
    data.append([
        Paragraph(dl, cell_s) if dl else "",
        Paragraph(eur(dm), r) if dm is not None else "",
        Paragraph(str(dd), c) if dd else "",
        Paragraph(rl, ls),
        Paragraph(eur(rm), rs) if rm is not None else "",
        Paragraph(ra, red_s if is_red else c),
    ])
data.append([Paragraph("Total des dépenses", ParagraphStyle("tw", parent=cell_b, textColor=white)),
             Paragraph(eur(8129.04), ParagraphStyle("twr", parent=cell_b, textColor=white, alignment=2)),
             Paragraph("=", c),
             Paragraph("Total des recettes", ParagraphStyle("tw2", parent=cell_b, textColor=white)),
             Paragraph(eur(8129.04), ParagraphStyle("twr2", parent=cell_b, textColor=white, alignment=2)), ""])
data.append(["", "", "", Paragraph("Budget équilibré (vérification automatique)", note_s),
             "", Paragraph("VRAI", ParagraphStyle("v", parent=cell_b, alignment=1))])

tbl = Table(data, colWidths=[9.2*cm, 3*cm, 2.3*cm, 5.2*cm, 2.8*cm, 2*cm], style=TableStyle([
    ("SPAN", (0,0), (2,0)), ("SPAN", (3,0), (5,0)),
    ("BACKGROUND", (0,0), (2,0), GREEN), ("BACKGROUND", (3,0), (5,0), BLUE),
    ("BACKGROUND", (0,1), (2,1), GREEN_L), ("BACKGROUND", (3,1), (5,1), BLUE_L),
    ("BACKGROUND", (0,9), (1,9), GREEN), ("BACKGROUND", (3,9), (4,9), BLUE),
    ("GRID", (0,1), (2,8), 0.5, HexColor("#B0B0B0")),
    ("GRID", (3,1), (5,8), 0.5, HexColor("#B0B0B0")),
    ("GRID", (0,9), (1,9), 0.5, HexColor("#B0B0B0")),
    ("GRID", (3,9), (4,9), 0.5, HexColor("#B0B0B0")),
    ("TOPPADDING", (0,0), (-1,-1), 3.5), ("BOTTOMPADDING", (0,0), (-1,-1), 3.5),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
]))
story.append(tbl)
story.append(Spacer(1, 8))
story.append(Paragraph("Transport vers Berlin non inclus dans ce budget (à ajouter selon le mode choisi : ICE direct dès 59,99 €/aller ou vol easyJet A/R 65–145 €). "
                       "Tarifs activités et BVG : tarifs 2026 du dossier d'organisation (bvg.de, smb.museum, ddr-museum.de), consultés le 31/08/2026, à reconfirmer avant réservation.", note_s))

doc = SimpleDocTemplate(OUT, pagesize=landscape(A4),
                        topMargin=1.2*cm, bottomMargin=1.2*cm, leftMargin=2.2*cm, rightMargin=2.2*cm,
                        title="Budget prévisionnel CAPE — Voyage Berlin", author="ROVER")
doc.build(story)
print("OK:", OUT)
