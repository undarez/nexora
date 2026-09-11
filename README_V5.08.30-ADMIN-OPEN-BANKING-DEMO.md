# NEXORA V5.08.30 — Admin Open Banking + Entreprise Démo

Console `/admin/open-banking` réservée au rôle administrateur. Elle expose les métadonnées opérationnelles des connexions, comptes, transactions observées et échéances 90 jours, sans secrets.

La migration `0099_admin_open_banking_demo_enterprise.sql` crée, si le compte demandé existe, un espace `NEXORA Entreprise — Démo` pour l'adresse administrateur demandée, avec un SIRET fictif explicitement marqué `nexora-admin-demo`, une connexion bancaire de démonstration et trois transactions de démonstration.
