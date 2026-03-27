// SysMLv2 standard library loader
// Fetches standard library files from /sysml.library/ and registers them with the LSP worker

import type SysmlLSPClient from './lspClient';

// All standard library files relative to /sysml.library/
// Load order: Kernel first (base types), then Systems Library, then Domain Libraries
const STDLIB_FILES = [
  // Kernel Semantic Library
  'Kernel Libraries/Kernel Semantic Library/Base.kerml',
  'Kernel Libraries/Kernel Semantic Library/KerML.kerml',
  'Kernel Libraries/Kernel Semantic Library/Links.kerml',
  'Kernel Libraries/Kernel Semantic Library/Objects.kerml',
  'Kernel Libraries/Kernel Semantic Library/Occurrences.kerml',
  'Kernel Libraries/Kernel Semantic Library/Performances.kerml',
  'Kernel Libraries/Kernel Semantic Library/Transfers.kerml',
  'Kernel Libraries/Kernel Semantic Library/StatePerformances.kerml',
  'Kernel Libraries/Kernel Semantic Library/TransitionPerformances.kerml',
  'Kernel Libraries/Kernel Semantic Library/ControlPerformances.kerml',
  'Kernel Libraries/Kernel Semantic Library/FeatureReferencingPerformances.kerml',
  'Kernel Libraries/Kernel Semantic Library/Metaobjects.kerml',
  'Kernel Libraries/Kernel Semantic Library/Clocks.kerml',
  'Kernel Libraries/Kernel Semantic Library/Triggers.kerml',
  'Kernel Libraries/Kernel Semantic Library/Observation.kerml',
  'Kernel Libraries/Kernel Semantic Library/SpatialFrames.kerml',
  // Kernel Data Type Library
  'Kernel Libraries/Kernel Data Type Library/ScalarValues.kerml',
  'Kernel Libraries/Kernel Data Type Library/VectorValues.kerml',
  'Kernel Libraries/Kernel Data Type Library/Collections.kerml',
  // Kernel Function Library
  'Kernel Libraries/Kernel Function Library/BaseFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/BooleanFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/NumericalFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/IntegerFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/NaturalFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/RealFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/RationalFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/ComplexFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/StringFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/ScalarFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/VectorFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/TrigFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/CollectionFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/SequenceFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/OccurrenceFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/ControlFunctions.kerml',
  'Kernel Libraries/Kernel Function Library/DataFunctions.kerml',
  // Systems Library
  'Systems Library/SysML.sysml',
  'Systems Library/Attributes.sysml',
  'Systems Library/Items.sysml',
  'Systems Library/Parts.sysml',
  'Systems Library/Ports.sysml',
  'Systems Library/Connections.sysml',
  'Systems Library/Interfaces.sysml',
  'Systems Library/Flows.sysml',
  'Systems Library/Actions.sysml',
  'Systems Library/States.sysml',
  'Systems Library/Constraints.sysml',
  'Systems Library/Calculations.sysml',
  'Systems Library/Cases.sysml',
  'Systems Library/Requirements.sysml',
  'Systems Library/AnalysisCases.sysml',
  'Systems Library/VerificationCases.sysml',
  'Systems Library/UseCases.sysml',
  'Systems Library/Allocations.sysml',
  'Systems Library/Metadata.sysml',
  'Systems Library/Views.sysml',
  'Systems Library/StandardViewDefinitions.sysml',
  // Domain Libraries — Quantities and Units
  'Domain Libraries/Quantities and Units/SIPrefixes.sysml',
  'Domain Libraries/Quantities and Units/ISQBase.sysml',
  'Domain Libraries/Quantities and Units/ISQSpaceTime.sysml',
  'Domain Libraries/Quantities and Units/ISQMechanics.sysml',
  'Domain Libraries/Quantities and Units/ISQElectromagnetism.sysml',
  'Domain Libraries/Quantities and Units/ISQThermodynamics.sysml',
  'Domain Libraries/Quantities and Units/ISQLight.sysml',
  'Domain Libraries/Quantities and Units/ISQAcoustics.sysml',
  'Domain Libraries/Quantities and Units/ISQInformation.sysml',
  'Domain Libraries/Quantities and Units/ISQCharacteristicNumbers.sysml',
  'Domain Libraries/Quantities and Units/ISQCondensedMatter.sysml',
  'Domain Libraries/Quantities and Units/ISQAtomicNuclear.sysml',
  'Domain Libraries/Quantities and Units/ISQChemistryMolecular.sysml',
  'Domain Libraries/Quantities and Units/ISQ.sysml',
  'Domain Libraries/Quantities and Units/Quantities.sysml',
  'Domain Libraries/Quantities and Units/MeasurementReferences.sysml',
  'Domain Libraries/Quantities and Units/MeasurementRefCalculations.sysml',
  'Domain Libraries/Quantities and Units/SI.sysml',
  'Domain Libraries/Quantities and Units/QuantityCalculations.sysml',
  'Domain Libraries/Quantities and Units/TensorCalculations.sysml',
  'Domain Libraries/Quantities and Units/VectorCalculations.sysml',
  // Domain Libraries — other
  'Domain Libraries/Geometry/SpatialItems.sysml',
  'Domain Libraries/Geometry/ShapeItems.sysml',
  'Domain Libraries/Metadata/ModelingMetadata.sysml',
  'Domain Libraries/Metadata/ParametersOfInterestMetadata.sysml',
  'Domain Libraries/Metadata/RiskMetadata.sysml',
  'Domain Libraries/Metadata/ImageMetadata.sysml',
  'Domain Libraries/Analysis/AnalysisTooling.sysml',
  'Domain Libraries/Analysis/SampledFunctions.sysml',
  'Domain Libraries/Analysis/StateSpaceRepresentation.sysml',
  'Domain Libraries/Analysis/TradeStudies.sysml',
  'Domain Libraries/Cause and Effect/CausationConnections.sysml',
  'Domain Libraries/Cause and Effect/CauseAndEffect.sysml',
  'Domain Libraries/Requirement Derivation/DerivationConnections.sysml',
  'Domain Libraries/Requirement Derivation/RequirementDerivation.sysml',
];

const BASE_URL = '/sysml.library/';
const STDLIB_URI_PREFIX = 'file:///sysml.library/';

export async function loadStandardLibrary(client: SysmlLSPClient): Promise<{ loaded: number; failed: number }> {
  let loaded = 0;
  let failed = 0;

  // Fetch in batches of 8 to avoid overwhelming the browser
  const BATCH = 8;
  for (let i = 0; i < STDLIB_FILES.length; i += BATCH) {
    const batch = STDLIB_FILES.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (relPath) => {
        try {
          const url = BASE_URL + relPath;
          const res = await fetch(url);
          if (!res.ok) { failed++; return; }
          const text = await res.text();
          const uri = STDLIB_URI_PREFIX + relPath;
          client.loadLibraryFile(uri, text);
          loaded++;
        } catch {
          failed++;
        }
      })
    );
  }

  return { loaded, failed };
}
