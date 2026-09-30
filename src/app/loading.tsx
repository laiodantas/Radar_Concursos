export default function Loading() {
  return <main className="app-shell" aria-busy="true" aria-label="Carregando o Radar de Concursos">
    <aside className="rail">
      <div className="brand"><span className="brand-mark">R</span><span>Radar<small>DE CONCURSOS</small></span></div>
      <div className="rail-label">Nesta edição</div>
    </aside>
    <section className="main-column">
      <header className="topbar"><span className="breadcrumb">RADAR <span>/</span> CONCURSOS PÚBLICOS</span></header>
      <div className="content">
        <div className="eyebrow"><span className="eyebrow-line"/>Carregando o painel</div>
        <div className="loading-block">
          <div className="skeleton title"/>
          <div className="skeleton subtitle"/>
          <div className="skeleton stats"/>
          <div className="skeleton row"/>
          <div className="skeleton row"/>
        </div>
        <p className="loading-label" role="status">Buscando concursos, prazos e novidades…</p>
      </div>
    </section>
  </main>;
}
