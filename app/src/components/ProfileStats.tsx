interface ProfileStat {
  label: string
  value: number
  onClick?: () => void
}

/** Même géométrie pour les compteurs simples et les raccourcis cliquables. */
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return <div className="profile-stats" role="group" aria-label="Statistiques du profil">
    {stats.map(({ label, value, onClick }) => {
      const content = <><strong>{value.toLocaleString('fr-FR')}</strong><span>{label}</span></>
      return onClick
        ? <button type="button" key={label} onClick={onClick}>{content}</button>
        : <div key={label}>{content}</div>
    })}
  </div>
}
