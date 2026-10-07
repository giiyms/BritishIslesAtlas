"""Layer table for ``scripts/osm_extract.py`` (OpenStreetMap point layers).

Every layer is one ``LayerSpec``: the OSM tag to query, the generic fallback
name, and the few things that differ per layer. Everything else (Overpass
tiling, admin-polygon clip, GeoJSON / extract-meta writing) is shared.

Fields
------
layer / tag_key / tag_value / generic_name
    Layer id (== ``data/osm/<layer>.geojson``), OSM tag ``key=value`` queried
    as node + way (+ relation), and the fallback ``name`` for unnamed objects.
require_name
    Query ``["name"]`` and drop unnamed objects (name=* required).
include_relations
    Also query ``relation`` objects (centre points). False for the older
    node+way-only layers.
min_count
    Post-run sanity gate: refuse if the count is below this (None = no gate at
    all, also skips the round-number / France-bleed checks).
max_span / timeout / retries / pause
    Per-layer defaults for the matching CLI flags (bbox tile span in degrees,
    Overpass timeout s, attempts per tile, pause s).
resilient
    Dense layers: cache each Overpass tile under
    ``scripts/cache/<layer>-tiles/`` (reruns skip finished tiles) and rotate
    through fallback Overpass endpoints on retry.
religion_prop
    Copy ``religion=*`` onto feature properties (places of worship).
limitations
    Extra ``limitations`` entries merged into this layer's extract-meta.json
    record, in order (``counting_caveat`` text, name-filter / tag-choice
    notes, probe counts). ``Stat(key)`` pulls a computed run statistic.
notes
    Condensed rationale from the retired per-layer scripts: tag choice, what
    is excluded, and density/count probes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Stat:
    """Placeholder for a computed statistic (resolved by osm_extract.build_meta)."""

    key: str


@dataclass(frozen=True)
class LayerSpec:
    layer: str
    tag_key: str
    tag_value: str
    generic_name: str
    require_name: bool = False
    include_relations: bool = True
    min_count: "int | None" = 50
    max_span: float = 2.5
    timeout: int = 180
    retries: int = 6
    pause: float = 6.0
    resilient: bool = False
    religion_prop: bool = False
    limitations: "dict[str, Any]" = field(default_factory=dict)
    notes: str = ""

    @property
    def tile_cache_dir(self) -> str:
        return f"{self.layer}-tiles"


_SPECS = [
    LayerSpec(
        layer='aerodromes',
        tag_key='aeroway',
        tag_value='aerodrome',
        generic_name='Aerodrome',
        limitations={
            'counting_caveat': (
                'aeroway=aerodrome only; helipads, airstrips tagged aeroway=airstrip (not '
                'aerodrome), runways, taxiways, hangars, terminals, and gates are omitted; '
                'feature counts are OSM objects not distinct airports (a complex may be '
                'several nodes/ways/relations); military / disused sites still tagged '
                'aeroway=aerodrome are included; multipolygon relations use Overpass '
                'centre points (not footprints), and a site may appear both as a relation '
                'and as member ways if both carry aeroway=aerodrome'
            ),
        },
        notes=(
            'Does NOT include aeroway=helipad, aeroway=airstrip, aeroway=runway, '
            'aeroway=taxiway, aeroway=hangar, aeroway=terminal, or aeroway=gate. '
            'Disused/closed sites retaining the tag are included.'
        ),
    ),
    LayerSpec(
        layer='aquariums',
        tag_key='tourism',
        tag_value='aquarium',
        generic_name='Aquarium',
        min_count=40,
        limitations={
            'counting_caveat': (
                'tourism=aquarium only; zoos, generic attractions, pet shops, and animal '
                'boarding without tourism=aquarium are omitted; koi/ornamental shops that '
                'carry tourism=aquarium in OSM are included; feature counts are OSM '
                'objects not distinct aquariums (a complex may be several '
                'nodes/ways/relations); disused sites still tagged tourism=aquarium are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry tourism=aquarium'
            ),
        },
        notes=(
            'Does NOT include tourism=zoo, tourism=attraction, amenity=animal_boarding, '
            'shop=pet, or buildings without tourism=aquarium. Koi / ornamental fish shops '
            'that carry tourism=aquarium in OSM ARE included (tagging noise). Large sites '
            'mapped as multipolygon relations are included via out center (Heathrow '
            'lesson).'
        ),
    ),
    LayerSpec(
        layer='arts-centres',
        tag_key='amenity',
        tag_value='arts_centre',
        generic_name='Arts centre',
        limitations={
            'counting_caveat': (
                'amenity=arts_centre only; theatres, cinemas, community centres, museums, '
                'galleries, and attractions without amenity=arts_centre are omitted; '
                'feature counts are OSM objects not distinct centres (a complex may be '
                'several nodes/ways/relations); disused sites still tagged '
                'amenity=arts_centre are included; multipolygon relations use Overpass '
                'centre points (not footprints), and a site may appear both as a relation '
                'and as member ways if both carry amenity=arts_centre'
            ),
        },
        notes=(
            'Does NOT include amenity=theatre, amenity=cinema, amenity=community_centre, '
            'tourism=museum, tourism=gallery, tourism=attraction, or buildings without '
            'amenity=arts_centre. Large centres mapped as multipolygon relations are '
            'included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='battlefields',
        tag_key='historic',
        tag_value='battlefield',
        generic_name='Battlefield',
        limitations={
            'counting_caveat': (
                'historic=battlefield only; memorials, ruins, castles, and sites without '
                'historic=battlefield are omitted; feature counts are OSM objects not '
                'distinct battles (a site may be several nodes/ways/relations); '
                'commemorative / heritage sites still tagged historic=battlefield are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry historic=battlefield'
            ),
        },
        notes=(
            'Does NOT include historic=battlefield_site (nonstandard), historic=memorial '
            'without battlefield, historic=ruins, historic=castle, tourism=battlefield, or '
            'war memorials. Disused / commemorative sites retaining historic=battlefield '
            'ARE included. Large battlefields mapped as multipolygon relations are '
            'included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='beaches',
        tag_key='natural',
        tag_value='beach',
        generic_name='Beach',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'natural=beach only; natural=coastline, natural=sand alone, '
                'leisure=beach_resort without natural=beach, and tourism=hotel are '
                'omitted; feature counts are OSM objects not distinct beaches (a stretch '
                'may be several nodes/ways/relations); disused sites still tagged '
                'natural=beach are included; multipolygon / site relations use Overpass '
                'centre points (not footprints), and a site may appear both as a relation '
                'and as member ways if both carry natural=beach; unnamed beaches keep the '
                'generic label Beach'
            ),
            'name_filter': (
                'no name=* filter; a loose BI bbox probe (incl. some N France coast) was '
                '~9.1k (n357/w8216/r567), inside the ~8-10k soft band (same bbox with '
                'name=* was ~2.0k: n201/w1607/r197). Dropping unnamed beaches would omit '
                'most of the layer, so they are kept'
            ),
            'france_bleed_note': (
                'Hard bbox heuristic flags 1 feature (relation/20327663, centre -1.928, '
                '49.291) just east of the Channel Islands exclusion box (lon -1.95). It is '
                'inside the Jersey admin polygon (Écréhous reef), not mainland France. '
                'Mainland France bleed = 0.'
            ),
        },
        notes=(
            'Does NOT include natural=coastline, natural=sand alone, leisure=beach_resort '
            'without natural=beach, or tourism=hotel. A loose British Isles bbox probe '
            '(49-61N, -11-2.2E, not admin-clipped, includes some northern France coast) '
            'was ~9.1k objects (nodes 357 + ways 8216 + relations 567), inside the ~8-10k '
            'soft band rather than blowing past it, so require_name stays off (unnamed '
            'beaches keep the generic label Beach). Coastal France bleed is clipped by the '
            'admin polygons. Large multipolygon / site relations use out center (Heathrow '
            'lesson — beaches are often ways/relations). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='camp-sites',
        tag_key='tourism',
        tag_value='camp_site',
        generic_name='Camp site',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'tourism=camp_site only; tourism=caravan_site, tourism=camp_pitch, '
                'tourism=hostel, and amenity=shelter without tourism=camp_site are omitted '
                '(caravan sites are a separate OSM tag and excluded); feature counts are '
                'OSM objects not distinct campsites (a complex may be several '
                'nodes/ways/relations); disused sites still tagged tourism=camp_site are '
                'included; multipolygon / site relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry tourism=camp_site; unnamed camp sites keep the generic '
                'label Camp site'
            ),
        },
        notes=(
            'Does NOT include tourism=caravan_site, tourism=camp_pitch, tourism=hostel, or '
            'amenity=shelter without tourism=camp_site. Unnamed sites keep the generic '
            'label "Camp site" unless require_name is enabled. Large multipolygon / site '
            'relations use out center (Heathrow lesson — camp sites are often '
            'ways/relations). Default --max-span ~2.0°; tighten and/or require name=* if '
            'density is intractable.'
        ),
    ),
    LayerSpec(
        layer='caravan-sites',
        tag_key='tourism',
        tag_value='caravan_site',
        generic_name='Caravan site',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'tourism=caravan_site only; tourism=camp_site (separate camp-sites layer), '
                'tourism=camp_pitch, tourism=hostel, and amenity=shelter without '
                'tourism=caravan_site are omitted; complements camp-sites which already '
                'excludes caravan_site; feature counts are OSM objects not distinct sites '
                '(a complex may be several nodes/ways/relations); disused sites still '
                'tagged tourism=caravan_site are included; multipolygon / site relations '
                'use Overpass centre points (not footprints), and a site may appear both '
                'as a relation and as member ways if both carry tourism=caravan_site; '
                'unnamed caravan sites keep the generic label Caravan site'
            ),
        },
        notes=(
            'Does NOT include tourism=camp_site (separate camp-sites layer), '
            'tourism=camp_pitch, tourism=hostel, or amenity=shelter without '
            'tourism=caravan_site. Unnamed sites keep the generic label "Caravan site" '
            'unless require_name is enabled. Large multipolygon / site relations use out '
            'center (Heathrow lesson — caravan sites are often ways/relations). Default '
            '--max-span ~2.0°; tighten and/or require name=* if density is intractable '
            '(~8–10k threshold).'
        ),
    ),
    LayerSpec(
        layer='castles',
        tag_key='historic',
        tag_value='castle',
        generic_name='Castle',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'historic=castle only; forts, manors, towers, ruins without castle tag, '
                'and archaeological sites are omitted; ruined castles still tagged '
                'historic=castle are included'
            ),
        },
        notes=(
            'Tight scope: historic=castle only. Does NOT include historic=ruins without '
            'castle, historic=fort, historic=manor, historic=archaeological_site, '
            'historic=tower, or castle-looking tourism attractions without the tag. Ruins '
            'that are still tagged historic=castle ARE included (common OSM usage).'
        ),
    ),
    LayerSpec(
        layer='cinemas',
        tag_key='amenity',
        tag_value='cinema',
        generic_name='Cinema',
        limitations={
            'counting_caveat': (
                'amenity=cinema only; theatres, arts centres, community centres, '
                'nightclubs, and attractions without amenity=cinema are omitted; feature '
                'counts are OSM objects not distinct cinemas (a multiplex may be several '
                'nodes/ways/relations); disused sites still tagged amenity=cinema are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry amenity=cinema'
            ),
        },
        notes=(
            'Does NOT include amenity=theatre, amenity=arts_centre, '
            'amenity=community_centre, tourism=attraction, amenity=nightclub, screen=* '
            'without amenity=cinema, or cinema buildings without amenity=cinema. Large '
            'cinemas mapped as multipolygon relations are included via out center '
            '(Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='clinics',
        tag_key='amenity',
        tag_value='clinic',
        generic_name='Clinic',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'tag_choice': (
                'Atlas preferred amenity=clinic is not already a LayerId and is usable '
                '(not empty; well under ~8-10k). This layer is amenity=clinic only. It '
                'does not include amenity=doctors, amenity=hospital, healthcare=* without '
                'amenity=clinic, or amenity=dentist. amenity=veterinary and '
                'amenity=supermarket were not needed. amenity=pub (preview pubs), wind '
                'turbines, and amenity=embassy are not this layer and were not retried.'
            ),
            'counting_caveat': (
                'amenity=clinic only; amenity=doctors, amenity=hospital, healthcare=* '
                'alone, and amenity=dentist are omitted; amenity=veterinary / '
                'amenity=supermarket / amenity=pub / wind turbines / amenity=embassy are '
                'not this layer; no second preview chip; feature counts are OSM objects '
                'not distinct clinics (a site may be several nodes/ways/relations); '
                'disused sites still tagged amenity=clinic are included; multipolygon / '
                'site relations use Overpass centre points (not footprints), and a site '
                'may appear both as a relation and as member ways if both carry '
                'amenity=clinic; no name=* filter (unnamed clinics kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed clinics kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
                'overpass.openstreetmap.fr, OSM base 2026-10-03T04:50:05Z) was 3076 (nodes '
                '1490 + ways 1525 + relations 61), well inside the ~8-10k soft guideline. '
                'A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, '
                'includes some northern France; OSM base 2026-10-03T04:52:03Z) was 3714 '
                '(nodes 1790 + ways 1838 + relations 86), also well under ~8k. The same '
                'England bbox with name=* was 2958 (nodes 1470 + ways 1429 + relations 59; '
                'OSM base 2026-10-03T04:51:05Z); the loose BI bbox with name=* was 3564 '
                '(nodes 1763 + ways 1718 + relations 83; OSM base 2026-10-03T04:53:15Z) '
                'before admin clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France. '
                'Jersey/Guernsey/Sark flags in the hard boxes are disclosed separately '
                'when they differ from the admin clip.'
            ),
        },
        notes=(
            'England-alone Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
            'admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T04:50:05Z) was '
            '3076 (nodes 1490 + ways 1525 + relations 61), well inside the ~8-10k soft '
            'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
            'admin-clipped, includes some northern France; OSM base 2026-10-03T04:52:03Z) '
            'was 3714 (nodes 1790 + ways 1838 + relations 86), also well under ~8k, so '
            'require_name is off. The same England bbox with name=* was 2958 (nodes 1470 + '
            'ways 1429 + relations 59; OSM base 2026-10-03T04:51:05Z); the loose BI bbox '
            'with name=* was 3564 (nodes 1763 + ways 1718 + relations 83; OSM base '
            '2026-10-03T04:53:15Z). Does NOT ship amenity=pub, wind turbines '
            '(generator:source=wind / power=generator), or amenity=embassy. Coastal France '
            'bleed is clipped by the admin polygons (Channel coast risk). Large '
            'multipolygon / site relations use out center (Heathrow lesson). Default '
            '--max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='community-centres',
        tag_key='amenity',
        tag_value='community_centre',
        generic_name='Community centre',
        require_name=True,
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'amenity=community_centre only; amenity=arts_centre (already an '
                'arts-centres layer), amenity=social_facility alone, '
                'leisure=fitness_centre / leisure=sports_centre, and tourism=attraction '
                'without amenity=community_centre are omitted; feature counts are OSM '
                'objects not distinct centres (a complex may be several '
                'nodes/ways/relations); disused sites still tagged '
                'amenity=community_centre are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry amenity=community_centre; '
                'named-only (name=* required); unnamed community centres omitted'
            ),
            'name_filter': 'require name=* (unnamed community centres omitted)',
        },
        notes=(
            'England-alone density exceeds the ~8–10k named-only threshold, so '
            'require_name is enabled (unnamed sites omitted; Overpass ["name"] filter). '
            'Large multipolygon / site relations use out center (Heathrow lesson — '
            'community centres are often ways/relations). Default --max-span ~2.0°.'
        ),
    ),
    LayerSpec(
        layer='courthouses',
        tag_key='amenity',
        tag_value='courthouse',
        generic_name='Courthouse',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'counting_caveat': (
                'amenity=courthouse only; office=lawyer, amenity=police, amenity=prison, '
                'and building=civic without amenity=courthouse are omitted; feature counts '
                'are OSM objects not distinct courthouses (a site may be several '
                'nodes/ways/relations); disused sites still tagged amenity=courthouse are '
                'included; multipolygon / site relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry amenity=courthouse; no name=* filter (unnamed courthouses '
                'kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed courthouses kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 412 '
                '(nodes 85 + ways 308 + relations 19), well inside the ~8-10k soft '
                'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
                'admin-clipped, includes some northern France) was 518 (nodes 104 + ways '
                '393 + relations 21), also well under ~8k. The same England bbox with '
                'name=* was 394 (nodes 82 + ways 295 + relations 17); the loose BI bbox '
                'with name=* was 485 (nodes 100 + ways 367 + relations 18) before admin '
                'clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Does NOT include office=lawyer, amenity=police, amenity=prison, or '
            'building=civic without amenity=courthouse. England-alone Overpass count '
            'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 412 '
            '(nodes 85 + ways 308 + relations 19), well inside the ~8-10k soft guideline. '
            'A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, '
            'includes some northern France) was 518 (nodes 104 + ways 393 + relations 21), '
            'also well under ~8k, so require_name is off. The same England bbox with '
            'name=* was 394 (nodes 82 + ways 295 + relations 17); the loose BI bbox with '
            'name=* was 485 (nodes 100 + ways 367 + relations 18). Coastal France bleed is '
            'clipped by the admin polygons (Channel coast risk). Large multipolygon / site '
            'relations use out center (Heathrow lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='dentists',
        tag_key='amenity',
        tag_value='dentist',
        generic_name='Dentist',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'tag_choice': (
                'Atlas preferred amenity=dentist is not already a LayerId and is usable '
                '(not empty; well under ~8-10k). This layer is amenity=dentist only. It '
                'does not include amenity=doctors, amenity=clinic (already shipped), '
                'amenity=hospital, or healthcare=dentist alone without amenity=dentist. '
                'amenity=veterinary and amenity=supermarket were not needed. amenity=pub '
                '(preview pubs), wind turbines, and amenity=embassy are not this layer and '
                'were not retried.'
            ),
            'counting_caveat': (
                'amenity=dentist only; amenity=doctors, amenity=clinic, amenity=hospital, '
                'and healthcare=dentist without amenity=dentist are omitted; '
                'amenity=veterinary / amenity=supermarket / amenity=pub / wind turbines / '
                'amenity=embassy are not this layer; no second preview chip; feature '
                'counts are OSM objects not distinct dentists (a site may be several '
                'nodes/ways/relations); disused sites still tagged amenity=dentist are '
                'included; multipolygon / site relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry amenity=dentist; no name=* filter (unnamed dentists kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed dentists kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
                'overpass.openstreetmap.fr, OSM base 2026-10-03T05:09:31Z) was 6270 (nodes '
                '3869 + ways 2396 + relations 5), well inside the ~8-10k soft guideline. A '
                'loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, '
                'includes some northern France and excludes Jersey/Guernsey south of '
                '49.8N; OSM base 2026-10-03T05:12:34Z) was 7151 (nodes 4591 + ways 2554 + '
                'relations 6), also well under ~8k. The same England bbox with name=* was '
                '5965 (nodes 3698 + ways 2263 + relations 4; OSM base '
                '2026-10-03T05:11:32Z); the loose BI bbox with name=* was 6794 (nodes 4390 '
                '+ ways 2399 + relations 5; OSM base 2026-10-03T05:13:30Z) before admin '
                'clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France. '
                'Jersey/Guernsey/Sark flags in the hard boxes are disclosed separately '
                'when they differ from the admin clip.'
            ),
        },
        notes=(
            'England-alone Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
            'admin-clipped; overpass.openstreetmap.fr, OSM base 2026-10-03T05:09:31Z) was '
            '6270 (nodes 3869 + ways 2396 + relations 5), well inside the ~8-10k soft '
            'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
            'admin-clipped, includes some northern France and excludes Jersey/Guernsey '
            'south of 49.8N; OSM base 2026-10-03T05:12:34Z) was 7151 (nodes 4591 + ways '
            '2554 + relations 6), also well under ~8k, so require_name is off. The same '
            'England bbox with name=* was 5965 (nodes 3698 + ways 2263 + relations 4; OSM '
            'base 2026-10-03T05:11:32Z); the loose BI bbox with name=* was 6794 (nodes '
            '4390 + ways 2399 + relations 5; OSM base 2026-10-03T05:13:30Z). Does NOT ship '
            'amenity=pub, wind turbines (generator:source=wind / power=generator), or '
            'amenity=embassy. Coastal France bleed is clipped by the admin polygons '
            '(Channel coast risk). Large multipolygon / site relations use out center '
            '(Heathrow lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='ev',
        tag_key='amenity',
        tag_value='charging_station',
        generic_name='EV charging',
        include_relations=False,
        min_count=None,
        limitations={
            'counting_caveat': 'amenity=charging_station may be site or device',
        },
        notes=(
            'amenity=charging_station may be a site or a single device. Nodes and ways '
            'only (no relations), no count sanity gate.'
        ),
    ),
    LayerSpec(
        layer='ferry-terminals',
        tag_key='amenity',
        tag_value='ferry_terminal',
        generic_name='Ferry terminal',
        limitations={
            'counting_caveat': (
                'amenity=ferry_terminal only; piers, harbours, route=ferry ways, '
                'public_transport=station without ferry_terminal, and ferry=* vehicle tags '
                'alone are omitted; feature counts are OSM objects not distinct terminals '
                '(a complex may be several nodes/ways/relations); disused sites still '
                'tagged amenity=ferry_terminal are included; multipolygon relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry amenity=ferry_terminal'
            ),
        },
        notes=(
            'Does NOT include man_made=pier, harbour=yes, amenity=ferry_terminal without '
            'the amenity tag variants, public_transport=station without ferry_terminal, '
            'route=ferry ways, or ferry=* vehicle tags alone. Large terminals mapped as '
            'multipolygon relations are included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='fire-stations',
        tag_key='amenity',
        tag_value='fire_station',
        generic_name='Fire station',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'amenity=fire_station only; hydrants, ambulance stations, and '
                'building=fire_station without amenity=fire_station are omitted'
            ),
        },
        notes=(
            'Does NOT include emergency=fire_hydrant, building=fire_station alone without '
            'amenity=fire_station, or ambulance stations (amenity=ambulance_station).'
        ),
    ),
    LayerSpec(
        layer='fitness-centres',
        tag_key='leisure',
        tag_value='fitness_centre',
        generic_name='Fitness centre',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=fitness_centre only; leisure=sports_centre (separate '
                'sports-centres layer), leisure=stadium, leisure=pitch alone, and '
                'amenity=gym without leisure=fitness_centre are omitted; complements '
                'sports-centres which already excludes fitness_centre without '
                'sports_centre; feature counts are OSM objects not distinct centres (a '
                'complex may be several nodes/ways/relations); disused sites still tagged '
                'leisure=fitness_centre are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry leisure=fitness_centre; unnamed '
                'fitness centres keep the generic label Fitness centre'
            ),
        },
        notes=(
            'Unnamed sites keep the generic label "Fitness centre" unless require_name is '
            'enabled. Large multipolygon / site relations use out center (Heathrow lesson '
            '— fitness centres are often ways/relations). Default --max-span ~2.0°; '
            'tighten and/or require name=* if density is intractable (~8–10k threshold).'
        ),
    ),
    LayerSpec(
        layer='galleries',
        tag_key='tourism',
        tag_value='gallery',
        generic_name='Gallery',
        min_count=40,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'tourism=gallery only; tourism=museum, amenity=arts_centre, shop=art '
                'without tourism=gallery, and tourism=attraction without tourism=gallery '
                'are omitted; complements museums layer which excludes galleries; feature '
                'counts are OSM objects not distinct galleries (a complex may be several '
                'nodes/ways/relations); disused sites still tagged tourism=gallery are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry tourism=gallery; unnamed galleries keep the generic label '
                'Gallery'
            ),
        },
        notes=(
            'Does NOT include tourism=museum, amenity=arts_centre, shop=art without '
            'tourism=gallery, or generic tourism=attraction. Large multipolygon / site '
            'relations use out center (Heathrow lesson). Default --max-span ~2.0°.'
        ),
    ),
    LayerSpec(
        layer='golf-courses',
        tag_key='leisure',
        tag_value='golf_course',
        generic_name='Golf course',
        min_count=40,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=golf_course only; driving ranges without leisure=golf_course, '
                'leisure=sports_centre, leisure=pitch, leisure=miniature_golf, and golf=* '
                'without leisure=golf_course are omitted; feature counts are OSM objects '
                'not distinct courses (a complex may be several nodes/ways/relations); '
                'disused sites still tagged leisure=golf_course are included; multipolygon '
                'relations use Overpass centre points (not footprints), and a site may '
                'appear both as a relation and as member ways if both carry '
                'leisure=golf_course; unnamed courses keep the generic label Golf course'
            ),
        },
        notes=(
            'Does NOT include driving ranges without leisure=golf_course, '
            'leisure=sports_centre, leisure=pitch, leisure=miniature_golf, or golf=course '
            'without the leisure tag. Large multipolygon / site relations use out center '
            '(Heathrow lesson). Default --max-span ~2.0° like stadiums/theme parks density '
            'class.'
        ),
    ),
    LayerSpec(
        layer='hospitals',
        tag_key='amenity',
        tag_value='hospital',
        generic_name='Hospital',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'amenity=hospital only; clinics, GPs, and healthcare=hospital without '
                'amenity=hospital are omitted'
            ),
        },
        notes=(
            'Does NOT include amenity=clinic, amenity=doctors, or healthcare=hospital '
            'alone.'
        ),
    ),
    LayerSpec(
        layer='libraries',
        tag_key='amenity',
        tag_value='library',
        generic_name='Library',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'amenity=library only; universities, colleges, schools, bookshops, '
                'building=library without amenity=library, and mobile libraries without '
                'the tag are omitted'
            ),
        },
        notes=(
            'Tight scope: amenity=library only. Does NOT include amenity=college, '
            'amenity=university, amenity=school, amenity=bookshop / shop=books, '
            'building=library without amenity=library, or mobile_library without the tag.'
        ),
    ),
    LayerSpec(
        layer='lighthouses',
        tag_key='man_made',
        tag_value='lighthouse',
        generic_name='Lighthouse',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'counting_caveat': (
                'man_made=lighthouse only; man_made=beacon, seamark:type=light_major alone '
                'without man_made=lighthouse, and historic=yes without man_made=lighthouse '
                'are omitted; feature counts are OSM objects not distinct lighthouses (a '
                'site may be several nodes/ways/relations); disused sites still tagged '
                'man_made=lighthouse are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry man_made=lighthouse; no name=* '
                'filter (unnamed lighthouses kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed lighthouses kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 314 '
                '(nodes 180 + ways 132 + relations 2), well inside the ~8-10k soft '
                'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
                'admin-clipped, includes some northern France) was 585 (nodes 337 + ways '
                '246 + relations 2), also well under ~8k. The same England bbox with '
                'name=* was 234 (nodes 122 + ways 110 + relations 2); the loose BI bbox '
                'with name=* was 452 (nodes 246 + ways 204 + relations 2) before admin '
                'clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Does NOT include man_made=beacon, seamark:type=light_major alone without '
            'man_made=lighthouse, or historic=yes without man_made=lighthouse. '
            'England-alone Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
            'admin-clipped) was 314 (nodes 180 + ways 132 + relations 2), well inside the '
            '~8-10k soft guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, '
            'not admin-clipped, includes some northern France) was 585 (nodes 337 + ways '
            '246 + relations 2), also well under ~8k, so require_name is off. The same '
            'England bbox with name=* was 234 (nodes 122 + ways 110 + relations 2); the '
            'loose BI bbox with name=* was 452 (nodes 246 + ways 204 + relations 2). '
            'Coastal France bleed is clipped by the admin polygons (Channel coast risk). '
            'Large multipolygon / site relations use out center (Heathrow lesson). Default '
            '--max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='marinas',
        tag_key='leisure',
        tag_value='marina',
        generic_name='Marina',
        limitations={
            'counting_caveat': (
                'leisure=marina only; harbours, slipways, boat rentals, piers, '
                'leisure=harbour, and seamark marina tags without leisure=marina are '
                'omitted; feature counts are OSM objects not distinct marinas (a complex '
                'may be several nodes/ways/relations); disused sites still tagged '
                'leisure=marina are included; multipolygon relations use Overpass centre '
                'points (not footprints), and a site may appear both as a relation and as '
                'member ways if both carry leisure=marina'
            ),
        },
        notes=(
            'Does NOT include harbour=yes, leisure=slipway, amenity=boat_rental, '
            'man_made=pier, seamark:type=marina without leisure=marina, or '
            'leisure=harbour. Large marinas mapped as multipolygon relations are included '
            'via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='marketplaces',
        tag_key='amenity',
        tag_value='marketplace',
        generic_name='Marketplace',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'amenity=marketplace only; shop=marketplace without amenity=marketplace, '
                'street_vendor, shop=convenience, and farmers markets without '
                'amenity=marketplace are omitted; feature counts are OSM objects not '
                'distinct markets (a complex may be several nodes/ways/relations); disused '
                'sites still tagged amenity=marketplace are included; multipolygon '
                'relations use Overpass centre points (not footprints), and a site may '
                'appear both as a relation and as member ways if both carry '
                'amenity=marketplace; unnamed marketplaces keep the generic label '
                'Marketplace'
            ),
        },
        notes=(
            'Does NOT include shop=marketplace without amenity=marketplace, street_vendor, '
            'shop=convenience, amenity=marketplace tag variants you would exclude via '
            'other amenity values, or farmers markets unless tagged amenity=marketplace. '
            'Large multipolygon / site relations use out center (Heathrow lesson — markets '
            'are often multipolygon). Default --max-span ~2.0°.'
        ),
    ),
    LayerSpec(
        layer='memorials',
        tag_key='historic',
        tag_value='memorial',
        generic_name='Memorial',
        require_name=True,
        min_count=40,
        max_span=1.5,
        timeout=120,
        limitations={
            'counting_caveat': (
                'historic=memorial WITH name=* only; unnamed plaques and memorial noise, '
                'historic=monument, historic=war_memorial without historic=memorial, '
                'memorial=yes on other keys, and tourism=attraction without '
                'historic=memorial are omitted; war memorials tagged historic=memorial ARE '
                'included; feature counts are OSM objects not distinct sites (a complex '
                'may be several nodes/ways/relations); disused sites still tagged '
                'historic=memorial with name are included; multipolygon relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry historic=memorial+name; raw '
                'unfiltered historic=memorial is notoriously dense/timeout-prone '
                'Isles-wide so this extract uses name=* and fine regional tiling'
            ),
            'name_filter': 'require name=* (unnamed memorials omitted)',
        },
        notes=(
            'Tight scope: historic=memorial WITH a name=* tag only (nodes, ways, and '
            'relations; relations use Overpass centre points like ways). War memorials '
            'that remain tagged historic=memorial ARE included. Multipolygon / site '
            'relations use out center. Default --max-span is tighter (1.5°) like ruins '
            'because memorials are denser than most leisure/tourism layers.'
        ),
    ),
    LayerSpec(
        layer='museums',
        tag_key='tourism',
        tag_value='museum',
        generic_name='Museum',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'tourism=museum only; galleries, generic attractions, arts centres, '
                'antique shops, historic=* without tourism=museum, and building=museum '
                'without the tourism tag are omitted; feature counts are OSM objects not '
                'distinct institutions (one museum may be several ways/nodes)'
            ),
        },
        notes=(
            'Tight scope: tourism=museum only. Does NOT include tourism=gallery, '
            'tourism=attraction, historic=* without tourism=museum, amenity=arts_centre, '
            'shop=antique, or building=museum without tourism=museum.'
        ),
    ),
    LayerSpec(
        layer='nature-reserves',
        tag_key='leisure',
        tag_value='nature_reserve',
        generic_name='Nature reserve',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=nature_reserve only; boundary=protected_area alone, leisure=park, '
                'boundary=national_park, leisure=wildlife_hide, and tourism=attraction '
                'without leisure=nature_reserve are omitted; feature counts are OSM '
                'objects not distinct reserves (a complex may be several '
                'nodes/ways/relations); disused sites still tagged leisure=nature_reserve '
                'are included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry leisure=nature_reserve; unnamed nature reserves keep the '
                'generic label Nature reserve'
            ),
        },
        notes=(
            'Does NOT include boundary=protected_area alone, leisure=park, '
            'boundary=national_park, leisure=wildlife_hide, or tourism=attraction without '
            'leisure=nature_reserve. Unnamed reserves keep the generic label "Nature '
            'reserve" unless require_name is enabled. Large multipolygon / site relations '
            'use out center (Heathrow lesson — nature reserves are often multipolygon). '
            'Default --max-span ~2.0°; tighten and/or require name=* if density is '
            'intractable.'
        ),
    ),
    LayerSpec(
        layer='nightclubs',
        tag_key='amenity',
        tag_value='nightclub',
        generic_name='Nightclub',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'tag_choice': (
                'Atlas preferred amenity=theatre (already LayerId theatres). Fallbacks '
                'amenity=cinema, leisure=stadium, and amenity=ferry_terminal are already '
                'LayerIds cinemas, stadiums, and ferry-terminals. Next unused tag in the '
                'civic/leisure entertainment family: amenity=nightclub.'
            ),
            'counting_caveat': (
                'amenity=nightclub only; amenity=bar, amenity=pub, amenity=theatre, '
                'amenity=casino, and leisure=dance without amenity=nightclub are omitted; '
                'the existing preview pubs chip is not this layer and is not replaced; '
                'feature counts are OSM objects not distinct nightclubs (a site may be '
                'several nodes/ways/relations); disused sites still tagged '
                'amenity=nightclub are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry amenity=nightclub; no name=* '
                'filter (unnamed nightclubs kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed nightclubs kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 1023 '
                '(nodes 607 + ways 414 + relations 2), well inside the ~8-10k soft '
                'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
                'admin-clipped, includes some northern France) was 1190 (nodes 744 + ways '
                '444 + relations 2), also well under ~8k. The same England bbox with '
                'name=* was 1006 (nodes 598 + ways 406 + relations 2); the loose BI bbox '
                'with name=* was 1167 (nodes 730 + ways 435 + relations 2) before admin '
                'clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'England-alone Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
            'admin-clipped) was 1023 (nodes 607 + ways 414 + relations 2), well inside the '
            '~8-10k soft guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, '
            'not admin-clipped, includes some northern France) was 1190 (nodes 744 + ways '
            '444 + relations 2), also well under ~8k, so require_name is off. The same '
            'England bbox with name=* was 1006 (nodes 598 + ways 406 + relations 2); the '
            'loose BI bbox with name=* was 1167 (nodes 730 + ways 435 + relations 2). '
            'Coastal France bleed is clipped by the admin polygons (Channel coast risk). '
            'Large multipolygon / site relations use out center (Heathrow lesson). Default '
            '--max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='petrol',
        tag_key='amenity',
        tag_value='fuel',
        generic_name='Petrol station',
        include_relations=False,
        min_count=None,
        notes=(
            'amenity=fuel (petrol stations). Formerly emitted together with ev by one '
            'script; nodes and ways only (no relations), no count sanity gate.'
        ),
    ),
    LayerSpec(
        layer='pharmacies',
        tag_key='amenity',
        tag_value='pharmacy',
        generic_name='Pharmacy',
        require_name=True,
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'counting_caveat': (
                'amenity=pharmacy only; amenity=clinic, amenity=doctors, shop=chemist '
                'without amenity=pharmacy, and healthcare=pharmacy alone without '
                'amenity=pharmacy are omitted; feature counts are OSM objects not distinct '
                'pharmacies (a site may be several nodes/ways/relations); disused sites '
                'still tagged amenity=pharmacy are included; multipolygon / site relations '
                'use Overpass centre points (not footprints), and a site may appear both '
                'as a relation and as member ways if both carry amenity=pharmacy; '
                'named-only (name=* required); unnamed pharmacies omitted'
            ),
            'name_filter': (
                'require name=* (unnamed pharmacies omitted). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 9235 '
                '(nodes 6554 + ways 2673 + relations 8), at the upper edge of the ~8-10k '
                'soft guideline for England alone. A loose British Isles bbox (49.8-61.0N, '
                '-10.8-1.9E, not admin-clipped, includes some northern France) was 11051 '
                '(nodes 8110 + ways 2932 + relations 9), past ~10k. The same England bbox '
                'with name=* was 8739 (nodes 6139 + ways 2592 + relations 8); the loose BI '
                'bbox with name=* was 10452 (nodes 7610 + ways 2834 + relations 8) before '
                'admin clip. Most UK pharmacies are named (Boots, Lloyds, and '
                'independents).'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Does NOT include amenity=clinic, amenity=doctors, shop=chemist without '
            'amenity=pharmacy, or healthcare=pharmacy alone without amenity=pharmacy. '
            'England-alone Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
            'admin-clipped) was 9235 (nodes 6554 + ways 2673 + relations 8), inside the '
            'upper edge of the ~8-10k soft guideline for England alone. A loose British '
            'Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, includes some northern '
            'France) was 11051 (nodes 8110 + ways 2932 + relations 9), past ~10k, so '
            'require_name is on. The same England bbox with name=* was 8739 (nodes 6139 + '
            'ways 2592 + relations 8); the loose BI bbox with name=* was 10452 (nodes 7610 '
            '+ ways 2834 + relations 8) before admin clip. Coastal France bleed is clipped '
            'by the admin polygons. Large multipolygon / site relations use out center '
            '(Heathrow lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='piers',
        tag_key='man_made',
        tag_value='pier',
        generic_name='Pier',
        require_name=True,
        min_count=40,
        limitations={
            'counting_caveat': (
                'man_made=pier WITH name=* only; unnamed pier/jetty segments, '
                'man_made=jetty/breakwater/groyne, marinas, ferry terminals, and pier=* '
                'without man_made=pier are omitted; feature counts are OSM objects not '
                'distinct piers (a complex may be several nodes/ways/relations); disused '
                'sites still tagged man_made=pier with name are included; multipolygon '
                'relations use Overpass centre points (not footprints), and a site may '
                'appear both as a relation and as member ways if both carry '
                'man_made=pier+name'
            ),
            'name_filter': 'require name=* (unnamed piers omitted)',
        },
        notes=(
            'Tight scope: man_made=pier WITH a name=* tag only (nodes, ways, and '
            'relations; relations use Overpass centre points like ways). Unnamed pier / '
            'jetty / pontoon segments are omitted — raw man_made=pier is ~20k+ mostly '
            'linear coastal noise. Does NOT include man_made=jetty, man_made=breakwater, '
            'man_made=groyne, leisure=marina, amenity=ferry_terminal, or pier=* without '
            'man_made=pier. Multipolygon / site relations use out center.'
        ),
    ),
    LayerSpec(
        layer='places-of-worship',
        tag_key='amenity',
        tag_value='place_of_worship',
        generic_name='Place of worship',
        require_name=True,
        min_count=20,
        max_span=2.0,
        resilient=True,
        religion_prop=True,
        limitations={
            'counting_caveat': (
                'amenity=place_of_worship only; building=church without '
                'amenity=place_of_worship, amenity=monastery alone, and tourism=attraction '
                'alone are omitted; not filtered by religion=* (religion copied onto '
                'properties when tagged); feature counts are OSM objects not distinct '
                'places of worship (a site may be several nodes/ways/relations); disused '
                'sites still tagged amenity=place_of_worship are included; multipolygon / '
                'site relations use Overpass centre points (not footprints), and a site '
                'may appear both as a relation and as member ways if both carry '
                'amenity=place_of_worship; name=* required (unnamed places of worship '
                'omitted)'
            ),
            'name_filter': (
                'name=* required (unnamed places of worship omitted). England-alone '
                'Overpass count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not '
                'admin-clipped) was 39954 (nodes 4454 + ways 35340 + relations 160), far '
                'past the ~8-10k soft guideline. The same England bbox with name=* was '
                '37859 (nodes 4028 + ways 33673 + relations 158). Named density is still '
                'high; the filter drops only unnamed objects.'
            ),
            'with_religion_tag': Stat('with_religion_tag'),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Does NOT include building=church without amenity=place_of_worship, '
            'amenity=monastery alone, or tourism=attraction alone. England-alone Overpass '
            'count without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was '
            '39954 (nodes 4454 + ways 35340 + relations 160), far past the ~8-10k soft '
            'guideline, so require_name is on. The same England bbox with name=* was 37859 '
            '(nodes 4028 + ways 33673 + relations 158) — still dense, but unnamed objects '
            'are omitted. Large multipolygon / site relations use out center (Heathrow '
            'lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='playgrounds',
        tag_key='leisure',
        tag_value='playground',
        generic_name='Playground',
        require_name=True,
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=playground only; leisure=pitch, leisure=park, amenity=school '
                'playgrounds without leisure=playground, and tourism=attraction alone are '
                'omitted; feature counts are OSM objects not distinct playgrounds (a '
                'complex may be several nodes/ways/relations); disused sites still tagged '
                'leisure=playground are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry leisure=playground; named-only '
                '(name=* required); unnamed playgrounds omitted'
            ),
            'name_filter': 'require name=* (unnamed playgrounds omitted)',
        },
        notes=(
            'Does NOT include leisure=pitch, leisure=park, amenity=school playgrounds '
            'without leisure=playground, or tourism=attraction alone. England-alone '
            'density without name=* is ~44k (far past the ~8–10k soft guideline), so '
            'require_name is enabled (unnamed sites omitted; Overpass ["name"] filter). '
            'Large multipolygon / site relations use out center (Heathrow lesson — '
            'playgrounds are often ways/relations). Default --max-span ~2.0°.'
        ),
    ),
    LayerSpec(
        layer='police',
        tag_key='amenity',
        tag_value='police',
        generic_name='Police station',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'amenity=police only; police boxes, cameras, and building=police without '
                'amenity=police are omitted'
            ),
        },
        notes=(
            'Does NOT include police boxes, traffic cameras, or amenity=police_box / '
            'barrier=police without amenity=police. Building-only tags without '
            'amenity=police are omitted.'
        ),
    ),
    LayerSpec(
        layer='post-offices',
        tag_key='amenity',
        tag_value='post_office',
        generic_name='Post office',
        require_name=True,
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'amenity=post_office only; amenity=parcel_locker, shop=convenience with a '
                'post_office role alone, Royal Mail collection points without '
                'amenity=post_office, and amenity=post_box are omitted; feature counts are '
                'OSM objects not distinct offices (a complex may be several '
                'nodes/ways/relations); disused sites still tagged amenity=post_office are '
                'included; multipolygon / site relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry amenity=post_office; named-only (name=* required); unnamed '
                'post offices omitted'
            ),
            'name_filter': 'require name=* (unnamed post offices omitted)',
        },
        notes=(
            'UK Geofabrik density is already ~9.4k at the ~8–10k soft guideline (full BI '
            'with Ireland would blow past it), so require_name is enabled (unnamed sites '
            'omitted; Overpass ["name"] filter). Large multipolygon / site relations use '
            'out center (Heathrow lesson — post offices are often ways/relations). Default '
            '--max-span ~2.0°.'
        ),
    ),
    LayerSpec(
        layer='power',
        tag_key='power',
        tag_value='plant',
        generic_name='Power plant',
        include_relations=False,
        min_count=None,
        limitations={
            'counting_caveat': 'power=plant is a site; individual generators are omitted',
        },
        notes=(
            'power=plant is a site; individual generators (power=generator) are omitted. '
            'Nodes and ways only (no relations), no count sanity gate.'
        ),
    ),
    LayerSpec(
        layer='prisons',
        tag_key='amenity',
        tag_value='prison',
        generic_name='Prison',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'tag_choice': (
                'Atlas preferred amenity=embassy is not already a LayerId but is unusable: '
                'deprecated (wiki 2018-12-01) in favour of office=diplomatic; taginfo '
                '2026-10-02 counts 60 worldwide (nodes 57 + ways 3 + relations 0); global '
                'Overpass (overpass.openstreetmap.fr, OSM base 2026-10-03T04:31:51Z) '
                'returned 60 elements and 0 in a rough British Isles box. England and '
                'loose BI amenity=embassy counts were 0. This layer does not ship '
                'amenity=embassy and does not include diplomatic=*, office=diplomatic, or '
                'amenity=consulate. Fallback amenity=prison is usable (not empty; well '
                'under ~8-10k). amenity=clinic was not needed. amenity=pub (preview pubs) '
                'and wind turbines were not used.'
            ),
            'counting_caveat': (
                'amenity=prison only; historic=prison, building=prison, and amenity=police '
                'without amenity=prison are omitted; diplomatic=* / office=diplomatic / '
                'amenity=embassy / amenity=consulate / amenity=clinic are not this layer; '
                'no second preview chip; feature counts are OSM objects not distinct '
                'prisons (a site may be several nodes/ways/relations); disused sites still '
                'tagged amenity=prison are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry amenity=prison; no name=* '
                'filter (unnamed prisons kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed prisons kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
                'overpass.openstreetmap.fr, OSM base 2026-10-03T04:31:51Z) was 178 (nodes '
                '4 + ways 164 + relations 10), well inside the ~8-10k soft guideline. A '
                'loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, '
                'includes some northern France; OSM base 2026-10-03T04:32:51Z) was 200 '
                '(nodes 4 + ways 184 + relations 12), also well under ~8k. The same '
                'England bbox with name=* was 166 (nodes 4 + ways 152 + relations 10); the '
                'loose BI bbox with name=* was 188 (nodes 4 + ways 172 + relations 12) '
                'before admin clip.'
            ),
            'embassy_unusable': (
                'amenity=embassy not shipped. Global 60 / British Isles 0 at extract '
                'planning time (see tag_choice).'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France. '
                'Jersey/Guernsey/Sark flags in the hard boxes are disclosed separately '
                'when they differ from the admin clip.'
            ),
        },
        notes=(
            'Tag choice: Atlas preferred amenity=embassy is NOT already a LayerId, but it '
            'is unusable here. The tag was deprecated (wiki vote 2018-12-01) in favour of '
            'office=diplomatic. Taginfo (data_until 2026-10-02T00:59:10Z) counts 60 '
            'worldwide (nodes 57 + ways 3 + relations 0). A global Overpass fetch '
            '(overpass.openstreetmap.fr, OSM base 2026-10-03T04:31:51Z) returned those 60 '
            'elements and 0 inside a rough British Isles box (49.0-61.2N, -11.0-2.2E). OSM '
            'base 2026-10-03T04:26:36Z). Fallback amenity=prison is usable (not empty, and '
            'well under ~8-10k). amenity=clinic was not needed. amenity=pub is the preview '
            'pubs chip and is not used. generator:source=wind / power=generator is the '
            'upcoming wind chip and is not used. England-alone Overpass count without '
            'name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
            'overpass.openstreetmap.fr, OSM base 2026-10-03T04:31:51Z) was 178 (nodes 4 + '
            'ways 164 + relations 10), well inside the ~8-10k soft guideline. A loose '
            'British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, includes some '
            'northern France; OSM base 2026-10-03T04:32:51Z) was 200 (nodes 4 + ways 184 + '
            'relations 12), also well under ~8k, so require_name is off. The same England '
            'bbox with name=* was 166 (nodes 4 + ways 152 + relations 10); the loose BI '
            'bbox with name=* was 188 (nodes 4 + ways 172 + relations 12). Coastal France '
            'bleed is clipped by the admin polygons (Channel coast risk). Large '
            'multipolygon / site relations use out center (Heathrow lesson). Default '
            '--max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='railway-stations',
        tag_key='railway',
        tag_value='station',
        generic_name='Railway station',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'railway=station only; halts, subway entrances, tram stops, bus stations, '
                'public_transport=station without railway=station, and '
                'building=train_station without the railway tag are omitted; feature '
                'counts are OSM objects not distinct stations (a complex may be several '
                'ways/nodes); heritage / disused stations still tagged railway=station are '
                'included'
            ),
        },
        notes=(
            'Tight scope: railway=station only. Does NOT include railway=halt, '
            'railway=subway_entrance, railway=tram_stop, public_transport=station without '
            'railway=station, amenity=bus_station, or building=train_station without '
            'railway=station.'
        ),
    ),
    LayerSpec(
        layer='ruins',
        tag_key='historic',
        tag_value='ruins',
        generic_name='Ruins',
        require_name=True,
        min_count=40,
        max_span=1.5,
        timeout=120,
        limitations={
            'counting_caveat': (
                'historic=ruins WITH name=* only; unnamed ruin fragments, '
                'historic=castle/archaeological_site/monument, ruins=yes on other keys, '
                'and building=ruins without historic=ruins are omitted; feature counts are '
                'OSM objects not distinct sites (a complex may be several '
                'nodes/ways/relations); disused sites still tagged historic=ruins with '
                'name are included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry historic=ruins+name; raw unfiltered historic=ruins is '
                'timeout-prone Isles-wide so this extract uses name=* and fine regional '
                'tiling'
            ),
            'name_filter': 'require name=* (unnamed ruins omitted)',
        },
        notes=(
            'Tight scope: historic=ruins WITH a name=* tag only (nodes, ways, and '
            'relations; relations use Overpass centre points like ways). Does NOT include '
            'historic=castle / archaeological_site / monument / ruins=yes on other '
            'historic keys, or building=ruins without historic=ruins. Multipolygon / site '
            'relations use out center. Default --max-span is tighter (1.5°) than piers '
            'because ruins queries are denser.'
        ),
    ),
    LayerSpec(
        layer='sports-centres',
        tag_key='leisure',
        tag_value='sports_centre',
        generic_name='Sports centre',
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=sports_centre only; leisure=stadium (separate layer), '
                'leisure=pitch alone, leisure=fitness_centre, and leisure=sports_hall '
                'without leisure=sports_centre are omitted; feature counts are OSM objects '
                'not distinct centres (a complex may be several nodes/ways/relations); '
                'disused sites still tagged leisure=sports_centre are included; '
                'multipolygon / site relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry leisure=sports_centre; unnamed sports centres keep the '
                'generic label Sports centre'
            ),
        },
        notes=(
            'Does NOT include leisure=stadium (separate layer), leisure=pitch alone, '
            'leisure=fitness_centre, or leisure=sports_hall without leisure=sports_centre '
            '— those tags are excluded unless the object also carries '
            'leisure=sports_centre. Unnamed sites keep the generic label "Sports centre" '
            'unless require_name is enabled. Large multipolygon / site relations use out '
            'center (Heathrow lesson — sports centres are often ways/relations). Default '
            '--max-span ~2.0°; tighten and/or require name=* if density is intractable '
            '(~8–10k threshold).'
        ),
    ),
    LayerSpec(
        layer='stadiums',
        tag_key='leisure',
        tag_value='stadium',
        generic_name='Stadium',
        limitations={
            'counting_caveat': (
                'leisure=stadium only; sports centres, pitches, tracks, and '
                'building=stadium without leisure=stadium are omitted; feature counts are '
                'OSM objects not distinct stadiums (a complex may be several '
                'nodes/ways/relations); disused sites still tagged leisure=stadium are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry leisure=stadium'
            ),
        },
        notes=(
            'Does NOT include leisure=sports_centre, leisure=pitch, leisure=track, '
            'leisure=stadium buildings without the leisure tag, building=stadium alone, '
            'amenity=theatre, or tourism=attraction. Large stadiums mapped as multipolygon '
            'relations are included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='swimming-pools',
        tag_key='leisure',
        tag_value='swimming_pool',
        generic_name='Swimming pool',
        require_name=True,
        min_count=20,
        max_span=2.0,
        limitations={
            'counting_caveat': (
                'leisure=swimming_pool only; leisure=water_park, amenity=public_bath, '
                'sport=swimming without leisure=swimming_pool, and natural=water are '
                'omitted; feature counts are OSM objects not distinct pools (a site may be '
                'several nodes/ways/relations); disused sites still tagged '
                'leisure=swimming_pool are included; multipolygon / site relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry leisure=swimming_pool; '
                'named-only (name=* required); unnamed pools (mostly private backyards) '
                'omitted'
            ),
            'name_filter': (
                'require name=* (unnamed pools omitted). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 23698 '
                '(nodes 366 + ways 23312 + relations 20), far past the ~8-10k soft '
                'guideline. The same England bbox with name=* was 478 (nodes 151 + ways '
                '324 + relations 3). Private backyard pools are typically unnamed.'
            ),
            'france_bleed_note': (
                'Hard bbox heuristic flags 0 features. Mainland France bleed = 0. '
                'Southernmost points are Jersey (Havre des Pas / Aquasplash) and Guernsey '
                'tidal pools (La Vallette), inside those admin polygons, not mainland '
                'France. Easternmost points (~1.7E, ~52.6N) are the Suffolk coast, not '
                'France.'
            ),
        },
        notes=(
            'Does NOT include leisure=water_park, amenity=public_bath, sport=swimming '
            'without leisure=swimming_pool, or natural=water. England-alone Overpass count '
            'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was ~23.7k '
            '(nodes 366 + ways 23312 + relations 20), far past the ~8-10k soft guideline — '
            'mostly unnamed private backyard pools — so require_name is on. The same '
            'England bbox with name=* was 478 (nodes 151 + ways 324 + relations 3). '
            'Coastal France bleed is clipped by the admin polygons. Large multipolygon / '
            'site relations use out center (Heathrow lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='theatres',
        tag_key='amenity',
        tag_value='theatre',
        generic_name='Theatre',
        limitations={
            'counting_caveat': (
                'amenity=theatre only; cinemas, arts centres, community centres, '
                'nightclubs, and attractions without amenity=theatre are omitted; feature '
                'counts are OSM objects not distinct theatres (a complex may be several '
                'nodes/ways/relations); disused sites still tagged amenity=theatre are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry amenity=theatre'
            ),
        },
        notes=(
            'Does NOT include amenity=cinema, amenity=arts_centre, '
            'amenity=community_centre, tourism=attraction, amenity=nightclub, or theatre '
            'buildings without amenity=theatre. Large theatres mapped as multipolygon '
            'relations are included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='theme-parks',
        tag_key='tourism',
        tag_value='theme_park',
        generic_name='Theme park',
        limitations={
            'counting_caveat': (
                'tourism=theme_park only; generic attractions, zoos, water parks, '
                'amusement arcades, and fairgrounds without tourism=theme_park are '
                'omitted; feature counts are OSM objects not distinct parks (a complex may '
                'be several nodes/ways/relations); disused sites still tagged '
                'tourism=theme_park are included; indoor soft-play / activity centres '
                'tagged theme_park in OSM are included; multipolygon relations use '
                'Overpass centre points (not footprints), and a site may appear both as a '
                'relation and as member ways if both carry tourism=theme_park'
            ),
        },
        notes=(
            'Does NOT include tourism=attraction, tourism=zoo, leisure=water_park, '
            'leisure=amusement_arcade, attraction=*, or fairgrounds without '
            'tourism=theme_park. Large parks mapped as multipolygon relations are included '
            'via out center (Heathrow lesson). OSM sometimes tags indoor soft-play / '
            'activity centres as theme_park — those objects are included when so tagged.'
        ),
    ),
    LayerSpec(
        layer='townhalls',
        tag_key='amenity',
        tag_value='townhall',
        generic_name='Town hall',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'counting_caveat': (
                'amenity=townhall only; amenity=community_centre, amenity=public_building '
                'alone, office=government, and building=civic without amenity=townhall are '
                'omitted; feature counts are OSM objects not distinct town halls (a site '
                'may be several nodes/ways/relations); disused sites still tagged '
                'amenity=townhall are included; multipolygon / site relations use Overpass '
                'centre points (not footprints), and a site may appear both as a relation '
                'and as member ways if both carry amenity=townhall; no name=* filter '
                '(unnamed town halls kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed town halls kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 1539 '
                '(nodes 302 + ways 1190 + relations 47), well inside the ~8-10k soft '
                'guideline. A loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not '
                'admin-clipped, includes some northern France) was 1826 (nodes 411 + ways '
                '1365 + relations 50), also well under ~8k. The same England bbox with '
                'name=* was 1423 (nodes 266 + ways 1113 + relations 44); the loose BI bbox '
                'with name=* was 1675 (nodes 362 + ways 1266 + relations 47) before admin '
                'clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Does NOT include amenity=community_centre (already a separate layer), '
            'amenity=public_building alone, office=government, or building=civic without '
            'amenity=townhall. England-alone Overpass count without name=* (bbox '
            '~49.9-55.8N, -6.5-2.0E, not admin-clipped) was 1539 (nodes 302 + ways 1190 + '
            'relations 47), well inside the ~8-10k soft guideline. A loose British Isles '
            'bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, includes some northern '
            'France) was 1826 (nodes 411 + ways 1365 + relations 50), also well under ~8k, '
            'so require_name is off. The same England bbox with name=* was 1423 (nodes 266 '
            '+ ways 1113 + relations 44); the loose BI bbox with name=* was 1675 (nodes '
            '362 + ways 1266 + relations 47). Coastal France bleed is clipped by the admin '
            'polygons. Large multipolygon / site relations use out center (Heathrow '
            'lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='universities',
        tag_key='amenity',
        tag_value='university',
        generic_name='University',
        include_relations=False,
        limitations={
            'counting_caveat': (
                'amenity=university only; colleges, schools, libraries, '
                'building=university without amenity=university, and faculties tagged only '
                'as amenity=college are omitted; feature counts are campus/site objects '
                'not institution counts'
            ),
        },
        notes=(
            'Tight scope: amenity=university only. Does NOT include amenity=college, '
            'amenity=school, amenity=library, building=university without '
            'amenity=university, or individual faculties/buildings tagged only as '
            'amenity=college.'
        ),
    ),
    LayerSpec(
        layer='viewpoints',
        tag_key='tourism',
        tag_value='viewpoint',
        generic_name='Viewpoint',
        limitations={
            'counting_caveat': (
                'tourism=viewpoint only; natural=peak and mountain tops without '
                'tourism=viewpoint, tourism=attraction, amenity=bench with a view, '
                'information=guidepost, and scenic overlooks lacking the tourism tag are '
                'omitted; feature counts are OSM objects not distinct scenic spots (a site '
                'may be several nodes/ways/relations); orientation/direction=* is unused; '
                'ways and rare multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry tourism=viewpoint'
            ),
        },
        notes=(
            'Does NOT include natural=peak / mountain peaks without tourism=viewpoint, '
            'tourism=attraction, amenity=bench with a view, information=guidepost, or '
            'generic scenic overlooks lacking the tourism tag. Orientation / direction=* '
            'tags are not used for geometry. Ways and rare multipolygon relations are '
            'included via out center (Heathrow lesson).'
        ),
    ),
    LayerSpec(
        layer='windmills',
        tag_key='man_made',
        tag_value='windmill',
        generic_name='Windmill',
        min_count=20,
        max_span=2.0,
        resilient=True,
        limitations={
            'tag_choice': (
                'Atlas preferred man_made=windmill (not already a LayerId). leisure=marina '
                'is already LayerId marinas. Fallbacks amenity=embassy and amenity=prison '
                'were not needed because man_made=windmill is usable (not empty; well '
                'under ~8-10k).'
            ),
            'counting_caveat': (
                'man_made=windmill only; generator:source=wind, power=generator alone, '
                'man_made=watermill, and historic=windmill without man_made=windmill are '
                'omitted; the upcoming wind-turbines preview chip (LayerId wind) is not '
                'this layer and is not replaced; feature counts are OSM objects not '
                'distinct windmills (a site may be several nodes/ways/relations); disused '
                'mills still tagged man_made=windmill are included; multipolygon / site '
                'relations use Overpass centre points (not footprints), and a site may '
                'appear both as a relation and as member ways if both carry '
                'man_made=windmill; no name=* filter (unnamed windmills kept)'
            ),
            'name_filter': (
                'no name=* filter (unnamed windmills kept). England-alone Overpass count '
                'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
                'overpass.openstreetmap.fr, OSM base 2026-10-03T04:10:59Z) was 555 (nodes '
                '276 + ways 279 + relations 0), well inside the ~8-10k soft guideline. A '
                'loose British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, '
                'includes some northern France) was 581 (nodes 283 + ways 298 + relations '
                '0), also well under ~8k. The same England bbox with name=* was 249 (nodes '
                '98 + ways 151 + relations 0); the loose BI bbox with name=* was 257 '
                '(nodes 100 + ways 157 + relations 0) before admin clip.'
            ),
            'france_bleed_note': (
                'Mainland France bleed checked after extract with the hard bbox heuristic '
                '(in_france_bleed). Admin polygons clip coastal France; southernmost '
                'retained points should be Channel Islands, not mainland France.'
            ),
        },
        notes=(
            'Tag choice: Atlas preferred man_made=windmill. It is not already a LayerId. '
            'leisure=marina is already LayerId marinas, so it is not reused. Fallbacks '
            'amenity=embassy and amenity=prison were not needed: man_made=windmill is '
            'usable (not empty, and well under the ~8-10k soft cap). Does NOT include '
            'generator:source=wind, power=generator alone, man_made=watermill, or '
            'historic=windmill without man_made=windmill. England-alone Overpass count '
            'without name=* (bbox ~49.9-55.8N, -6.5-2.0E, not admin-clipped; '
            'overpass.openstreetmap.fr, OSM base 2026-10-03T04:10:59Z) was 555 (nodes 276 '
            '+ ways 279 + relations 0), well inside the ~8-10k soft guideline. A loose '
            'British Isles bbox (49.8-61.0N, -10.8-1.9E, not admin-clipped, includes some '
            'northern France) was 581 (nodes 283 + ways 298 + relations 0), also well '
            'under ~8k, so require_name is off. The same England bbox with name=* was 249 '
            '(nodes 98 + ways 151 + relations 0); the loose BI bbox with name=* was 257 '
            '(nodes 100 + ways 157 + relations 0). Coastal France bleed is clipped by the '
            'admin polygons (Channel coast risk). Large multipolygon / site relations use '
            'out center (Heathrow lesson). Default --max-span ~2.0.'
        ),
    ),
    LayerSpec(
        layer='zoos',
        tag_key='tourism',
        tag_value='zoo',
        generic_name='Zoo',
        limitations={
            'counting_caveat': (
                'tourism=zoo only; aquariums, wildlife parks, animal shelters/boarding, '
                'theme parks, and safari/farm parks without tourism=zoo are omitted; '
                'feature counts are OSM objects not distinct zoos (a complex may be '
                'several nodes/ways/relations); disused sites still tagged tourism=zoo are '
                'included; multipolygon relations use Overpass centre points (not '
                'footprints), and a site may appear both as a relation and as member ways '
                'if both carry tourism=zoo'
            ),
        },
        notes=(
            'Does NOT include tourism=aquarium, tourism=wildlife_park, '
            'leisure=animal_boarding, amenity=animal_shelter, tourism=theme_park, or '
            'safari / farm parks without tourism=zoo. Large zoos mapped as multipolygon '
            'relations are included via out center (Heathrow lesson).'
        ),
    ),
]

LAYERS: "dict[str, LayerSpec]" = {s.layer: s for s in _SPECS}
