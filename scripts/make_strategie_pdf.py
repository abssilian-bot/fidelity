# -*- coding: utf-8 -*-
"""PDF de synthèse : stratégie de monétisation « On mange quoi / Fidelity »."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)

OUT = r"C:\Users\jebza\Documents\Kimi\Workspaces\OnMangeQuoi\strategie-monetisation.pdf"

ORANGE = HexColor("#C2410C")   # orange sombre (couleur de l'app)
DARK = HexColor("#333333")
GRAY = HexColor("#666666")
LIGHT = HexColor("#f5f5f5")

styles = getSampleStyleSheet()
title = ParagraphStyle("Titre", parent=styles["Title"], fontName="Helvetica-Bold",
                       fontSize=20, leading=24, textColor=ORANGE, alignment=0, spaceAfter=2)
subtitle = ParagraphStyle("SousTitre", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=10.5, leading=14, textColor=GRAY, spaceAfter=14)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=13, leading=16, textColor=DARK, spaceBefore=14, spaceAfter=6)
body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica",
                      fontSize=10, leading=14.5, textColor=DARK, spaceAfter=5)
bullet = ParagraphStyle("Bullet", parent=body, leftIndent=14, bulletIndent=4, spaceAfter=3)
cell = ParagraphStyle("Cell", parent=body, fontSize=9.5, leading=12.5, spaceAfter=0)
cellb = ParagraphStyle("CellB", parent=cell, fontName="Helvetica-Bold")
pitch = ParagraphStyle("Pitch", parent=body, fontName="Helvetica-Oblique",
                       fontSize=10.5, leading=15, leftIndent=10, rightIndent=10,
                       textColor=ORANGE, spaceBefore=4, spaceAfter=4)

doc = SimpleDocTemplate(OUT, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                        leftMargin=2.2*cm, rightMargin=2.2*cm,
                        title="Stratégie de monétisation — On mange quoi",
                        author="On mange quoi / Fidelity")
story = []

story.append(Paragraph("Stratégie de monétisation", title))
story.append(Paragraph("On mange quoi / Fidelity — vision rapide · 31 août 2026", subtitle))

# --- Le modèle retenu ---
story.append(Paragraph("Le modèle retenu : 3 piliers", h2))
story.append(Paragraph(
    "<b>1. Abonnement freemium / premium.</b> Gratuit : présence dans le catalogue, "
    "1 programme de fidélité, stats basiques. Premium (~19-29 €/mois) : programmes illimités, "
    "statistiques avancées, mise en avant, affiches premium — <b>+ des services inclus "
    "(photoshoot des plats, impression des affiches QR…)</b> qui justifient le prix et créent "
    "un contact physique avec le restaurateur.", body))
story.append(Paragraph(
    "<b>2. Frais sur les récompenses débloquées.</b> ~0,30 € prélevés uniquement quand un client "
    "utilise réellement sa récompense. <b>Risque zéro pour le restaurant</b> : il ne paie que "
    "quand la fidélité a fonctionné. Mesuré automatiquement par le ledger de scans — "
    "preuve à l'appui, aucune contestation possible.", body))
story.append(Paragraph(
    "<b>3. White-label pour chaînes et franchises.</b> Une enseigne multi-sites qui veut "
    "son propre wallet de fidélité : contrat annuel à 4 chiffres. Un seul contrat finance "
    "des mois de développement.", body))

# --- Séquençage ---
story.append(Paragraph("Séquençage", h2))
rows = [
    [Paragraph("Période", cellb), Paragraph("Moteur de revenu", cellb), Paragraph("Objectif", cellb)],
    [Paragraph("0 – 6 mois", cell), Paragraph("Gratuit + restos « fondateurs » à tarif symbolique", cell),
     Paragraph("Volume et preuve, pas de chiffre", cell)],
    [Paragraph("6 – 18 mois", cell), Paragraph("Freemium premium + frais sur récompenses", cell),
     Paragraph("Revenu stable + variable aligné sur la valeur prouvée", cell)],
    [Paragraph("18 mois +", cell), Paragraph("White-label, pub sponsorisée, tendances agrégées", cell),
     Paragraph("Monétisation d'échelle", cell)],
]
t = Table(rows, colWidths=[3*cm, 8*cm, 5.6*cm])
t.setStyle(TableStyle([
    ("LINEABOVE", (0, 0), (-1, 0), 1.5, DARK),
    ("LINEBELOW", (0, 0), (-1, 0), 0.75, DARK),
    ("LINEBELOW", (0, -1), (-1, -1), 1.5, DARK),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(t)

# --- Argumentaire ---
story.append(Paragraph("L'argumentaire de vente", h2))
story.append(Paragraph(
    "« Gratuit pour être listé. Vous ne payez plein tarif que quand on vous apporte "
    "des clients mesurables — et on vous le prouve scan par scan. »", pitch))
story.append(Paragraph(
    "C'est ce qui différencie l'app d'une pub Google : le ledger de fidélité sait exactement "
    "quel client est venu, quand, et combien de fois. La commission se justifie par la preuve, "
    "pas par la promesse.", body))

# --- Écarté ---
story.append(Paragraph("Écarté (pour mémoire)", h2))
story.append(Paragraph("• <b>Commission sur réservations</b> : chantier trop lourd (dispo temps réel des tables), terrain occupé par TheFork.", bullet))
story.append(Paragraph("• <b>Vente de données brutes</b> : risque RGPD/CNIL + valeur nulle sans échelle. Plus tard, uniquement sous forme de tendances agrégées anonymisées.", bullet))
story.append(Paragraph("• <b>Pub / mise en avant payante au lancement</b> : invendable sans audience ; revient en phase 18 mois +.", bullet))

doc.build(story)
print("OK:", OUT)
