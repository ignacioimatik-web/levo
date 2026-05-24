# Content Audit - Morella Singletracks Project

## 1. Analysis of Original Website (http://www.morellasingletracks.com/)

The original website is a catalog of MTB/enduro routes in the Morella and Els Ports area. It provides free access to route information and GPS tracks, with a business model based on promoting local accommodation (Cases de Morella).

### Found Content

#### Main Pages & Navigation
- **Inicio (Home):** Features news, videos, and links to other sections.
- **Noticias (News):** Updates about the MTB scene and route modifications.
- **Observaciones (Observations):** Likely safety or route status updates.
- **¿Quiénes Somos? (About Us):** Information about the project.
- **Morella Singletracks RUTAS (Top Tracks):** The core catalog, organized by sectors.
- **Información de Interés (Information of Interest):** Likely contains general info, perhaps logistics or safety.
- **Otras Rutas BTT Els Ports:** Link to external/related BTT routes.
- **Contacto/Reservas:** Integration with `casesdemorella.com` and local contact info.

#### Sectors Identified
- **Bergantes:** High interest, combination of pedaling and technical descents.
- **Celumbres:** Natural park environment, rocky/forest.
- **El Riu de les Corces:** "Mundo Perdido" valley, high density of singletracks.
- **Peter Rules:** North-east of Morella, forest and broken orography.
- **Torre Miró - Xiva:** Varied technicality, close to Morella, includes Xiva.

#### Route Data (Available in List)
- Name
- Distance (Km)
- Elevation Gain (m)
- Difficulty (5-star scale using yellow/black stars)
- Trail Percentage (%)
- Sector association

#### Route Data (Available in Individual Pages - inferred)
- Detailed description
- Downloadable GPS tracks (compressed files)
- Multimedia (Images/Videos)

---

## 2. Content Gap Analysis

The following data points are **NOT** available in the main list and will require manual extraction from individual route pages or will be marked as "pendiente de completar" (pending):

### Route Technical Data
- [ ] Slug (to be generated)
- [ ] Elevation Loss (m)
- [ ] Max Altitude (m)
- [ ] Min Altitude (m)
- [ ] Estimated Time
- [ ] Physical Difficulty (granularity beyond stars)
- [ ] Technical Difficulty (granularity beyond stars)
- [ ] Recommended Level (Iniciación, Medio, Avanzado, Experto)
- [ ] Recommended Bike type
- [ ] eBike friendliness
- [ ] Specific trail/pista/asphalt breakdown

### Route Context & Safety
- [ ] Detailed Warnings
- [ ] Water Points
- [ ] Dangerous Points
- [ ] Recommended Season
- [ ] Tags/Categories
- [ ] Related Routes
- [ ] Status (Public/Closed/Pending)

### General Content
- [ ] High-quality imagery (original site seems to have older/smaller images)
- [ ] Detailed "Planifica" (Planning) content (How to use GPX, Apps, etc.)
- [ ] Detailed "Morella" (Tourism) content (Heritage, Gastronomy, etc.)
- [ ] "Seguridad" (Safety) comprehensive section

---

## 3. Proposed New Website Structure

The new website will implement the following architecture:

1.  `/` - **Home**: Impactful landing page (Morella as destination, MTB/enduro essence).
2.  `/rutas` - **Route Library**: Filterable list (Sector, Difficulty, Distance, Type, eBike).
3.  `/rutas/[slug]` - **Route Detail**: Full technical sheet, maps, GPX download, related routes.
4.  `/sectores` - **Sectors**: Visual cards of the 5 main sectors.
5.  `/top-tracks` - **Top Tracks**: Showcase of the best/most technical segments.
6.  `/travesias` - **Multi-day Trips**: Itineraries for longer journeys.
7.  `/planifica` - **Planning**: Guide for GPS, gear, weather, and local logistics.
8.  `/morella` - **Tourism**: Morella's heritage, nature, and local services.
9.  `/seguridad` - **Safety & Responsibility**: Legal disclaimers and best practices.
10. `/contacto` - **Contact**: Contact form and incident reporting.

---

## 4. Manual Data Entry Tasks

- [ ] Extract all route details from `morella-top-tracks-rutas.php` for each ID.
- [ ] Map the 5-star system to the new `RouteDifficulty` model.
- [ ] Create descriptions for Sectors.
- [ ] Verify all GPS track links and files.
