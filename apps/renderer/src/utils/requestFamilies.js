// Function to extract the base path from a URL
export const getBasePath = (url) => {
  try {
    // Remove query parameters and fragments
    const cleanUrl = url.split("?")[0].split("#")[0];

    // Remove leading slash if present
    const path = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;

    // Split by slashes
    const segments = path.split("/").filter((segment) => segment.length > 0);

    if (segments.length === 0) return "/";

    // For single segment paths, return as is (e.g., "cars" from "/cars")
    if (segments.length === 1) return segments[0];

    // For multi-segment paths, return just the first segment to group similar paths
    // This will group /cars, /cars/1, /cars/3 all under "cars"
    return segments[0];
  } catch (error) {
    return url;
  }
};

// Function to create nested family structure for complex paths
export const createNestedFamilies = (requests) => {
  const families = {};

  requests.forEach((request) => {
    const cleanUrl = request.url.split("?")[0].split("#")[0];
    const path = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
    const segments = path.split("/").filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      // Root path - group by path only, not method
      const familyKey = "/";
      if (families[familyKey] === undefined) {
        families[familyKey] = {
          basePath: "/",
          methods: new Set(),
          requests: [],
          subfamilies: {},
          count: 0,
        };
      }
      families[familyKey].methods.add(request.method);
      families[familyKey].requests.push(request);
      families[familyKey].count++;
      return;
    }

    // Create nested structure - group by path only, not method
    const mainFamily = segments[0]; // e.g., "workers", "cars"
    const familyKey = mainFamily; // Remove method from key

    if (families[familyKey] === undefined) {
      families[familyKey] = {
        basePath: mainFamily,
        methods: new Set(),
        requests: [],
        subfamilies: {},
        count: 0,
      };
    }

    families[familyKey].methods.add(request.method);
    families[familyKey].count++;

    if (segments.length === 1) {
      // Direct request to the main family (e.g., GET /cars, POST /cars)
      families[familyKey].requests.push(request);
    } else {
      // Nested request (e.g., GET /workers/cars/1, POST /workers/cars/1)
      const subPath = segments.slice(1).join("/");
      const subFamilyKey = segments[1]; // Second level grouping

      if (families[familyKey].subfamilies[subFamilyKey] === undefined) {
        families[familyKey].subfamilies[subFamilyKey] = {
          basePath: subFamilyKey,
          fullPath: `${mainFamily}/${subFamilyKey}`,
          methods: new Set(),
          requests: [],
          count: 0,
        };
      }

      families[familyKey].subfamilies[subFamilyKey].methods.add(request.method);
      families[familyKey].subfamilies[subFamilyKey].requests.push(request);
      families[familyKey].subfamilies[subFamilyKey].count++;
    }
  });

  return families;
};

// Function to group requests by their path families with improved logic
export const groupRequestsByFamily = (requests) => {
  const nestedFamilies = createNestedFamilies(requests);

  // Convert to array format for rendering
  return Object.values(nestedFamilies).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Ensure basePath is always a string before calling localeCompare
    const aPath = a.basePath || "";
    const bPath = b.basePath || "";
    return aPath.localeCompare(bPath);
  });
};

// Helper function to count all actual mocks in a family tree
const countAllMocksInFamily = (family) => {
  let totalMocks = 0;

  // Count direct mocks
  if (family.mocks && family.mocks.length > 0) {
    totalMocks += family.mocks.length;
  }

  // Recursively count mocks in subfamilies
  if (family.subfamilies) {
    Object.values(family.subfamilies).forEach((subfamily) => {
      totalMocks += countAllMocksInFamily(subfamily);
    });
  }

  return totalMocks;
};

// Function to get a display name for a mock family
export const getMockFamilyDisplayName = (family) => {
  const { basePath, methods, mocks, count, subfamilies } = family;

  // Count all actual mocks in the family tree
  const actualMockCount = countAllMocksInFamily(family);
  const directMockCount = (mocks && mocks.length) || 0;
  const methodsList = Array.from(methods || [])
    .sort()
    .join(", ");

  // If there are subfamilies but no direct mocks, try to show the common path
  if (
    directMockCount === 0 &&
    subfamilies &&
    Object.keys(subfamilies).length > 0
  ) {
    // Get the first subfamily to extract path information
    const firstSubfamily = Object.values(subfamilies)[0];
    if (firstSubfamily && firstSubfamily.fullPath) {
      const pathParts = firstSubfamily.fullPath
        .split("/")
        .filter((part) => part.length > 0);
      if (pathParts.length > 0) {
        return `${pathParts[0]}/* (${actualMockCount})`;
      }
    }
  }

  // Handle root path case
  if (!basePath || basePath === "/") {
    return `/ (${actualMockCount})`;
  }

  // For families with only nested mocks (no direct mocks), show total count
  if (directMockCount === 0 && actualMockCount > 0) {
    return `${basePath}/* (${actualMockCount})`;
  }

  // For families with direct mocks
  return `${basePath}/ (${actualMockCount})`;
};

// Function to get a display name for a request family
export const getFamilyDisplayName = (family) => {
  const { basePath, methods, count } = family;
  const methodsList = Array.from(methods).sort().join(", ");
  return `${methodsList} /${basePath} (${count} request${
    count !== 1 ? "s" : ""
  })`;
};

// Function to get subfamilies within a family (for nested organization)
export const getSubfamilies = (family) => {
  const subfamilies = [];

  // Add direct requests to the family
  if (family.requests && family.requests.length > 0) {
    subfamilies.push({
      path: `/${family.basePath}`,
      requests: family.requests,
      count: family.requests.length,
      isMainPath: true,
      methods: family.methods,
    });
  }

  // Add subfamilies
  if (family.subfamilies) {
    Object.values(family.subfamilies).forEach((subfamily) => {
      subfamilies.push({
        path: `/${subfamily.fullPath}`,
        requests: subfamily.requests,
        count: subfamily.count,
        isSubPath: true,
        subName: subfamily.basePath,
        methods: subfamily.methods,
      });
    });
  }

  return subfamilies.sort((a, b) => {
    // Main path first, then by count
    if (a.isMainPath && !b.isMainPath) return -1;
    if (!a.isMainPath && b.isMainPath) return 1;
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Ensure path is always a string before calling localeCompare
    const aPath = a.path || "";
    const bPath = b.path || "";
    return aPath.localeCompare(bPath);
  });
};

// Helper function to recursively create nested family structure
const createFamilyStructure = (segments, mock, currentPath = "") => {
  if (segments.length === 0) {
    return {
      mocks: [mock],
      count: 1,
      methods: new Set([mock.method]),
      subfamilies: {},
    };
  }

  const [currentSegment, ...remainingSegments] = segments;
  const newPath = currentPath
    ? `${currentPath}/${currentSegment}`
    : currentSegment;

  return {
    mocks: [],
    count: 1,
    methods: new Set([mock.method]),
    subfamilies: {
      [currentSegment]: {
        basePath: currentSegment,
        fullPath: newPath,
        ...createFamilyStructure(remainingSegments, mock, newPath),
      },
    },
  };
};

// Helper function to merge family structures
const mergeFamilyStructures = (existing, newStructure) => {
  const merged = {
    mocks: [...existing.mocks, ...newStructure.mocks],
    count: existing.count + newStructure.count,
    methods: new Set([...existing.methods, ...newStructure.methods]),
    subfamilies: { ...existing.subfamilies },
  };

  // Merge subfamilies recursively
  Object.keys(newStructure.subfamilies).forEach((key) => {
    if (merged.subfamilies[key]) {
      merged.subfamilies[key] = {
        basePath: merged.subfamilies[key].basePath || key, // Ensure basePath is set
        fullPath: merged.subfamilies[key].fullPath || key,
        ...mergeFamilyStructures(
          merged.subfamilies[key],
          newStructure.subfamilies[key]
        ),
      };
    } else {
      merged.subfamilies[key] = {
        basePath: key, // Ensure basePath is set for new subfamilies
        ...newStructure.subfamilies[key],
      };
    }
  });

  return merged;
};

// Functions for mock families (with unlimited nesting support)
export const groupMocksByFamily = (mocks) => {
  const families = {};

  // Ensure mocks is an array and filter out any malformed mocks
  const safeMocks = Array.isArray(mocks)
    ? mocks.filter((mock) => mock && typeof mock === "object" && mock.url)
    : [];

  safeMocks.forEach((mock) => {
    const cleanUrl = mock.url.split("?")[0].split("#")[0];
    const path = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
    const segments = path.split("/").filter((segment) => segment.length > 0);

    const basePath = segments.length === 0 ? "/" : segments[0];
    const familyKey = basePath;

    if (families[familyKey] === undefined) {
      families[familyKey] = {
        basePath,
        methods: new Set(),
        mocks: [],
        subfamilies: {},
        count: 0,
      };
    }

    families[familyKey].methods.add(mock.method);
    families[familyKey].count++;

    if (segments.length <= 1) {
      families[familyKey].mocks.push(mock);
    } else {
      // Create nested structure for remaining segments
      const remainingSegments = segments.slice(1);
      const nestedStructure = createFamilyStructure(
        remainingSegments,
        mock,
        basePath
      );

      // Merge with existing structure
      families[familyKey] = mergeFamilyStructures(
        families[familyKey],
        nestedStructure
      );
    }
  });

  return Object.values(families).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Ensure basePath is always a string before calling localeCompare
    const aPath = a.basePath || "";
    const bPath = b.basePath || "";
    return aPath.localeCompare(bPath);
  });
};

export const getMockSubfamilies = (family) => {
  const subfamilies = [];

  // Add direct mocks to the family (only if they exist)
  if (family.mocks && family.mocks.length > 0) {
    subfamilies.push({
      path: `/${family.basePath || ""}`,
      mocks: family.mocks,
      count: family.mocks.length,
      isMainPath: true,
      methods: family.methods,
    });
  }

  // Add subfamilies recursively
  if (family.subfamilies) {
    Object.values(family.subfamilies).forEach((subfamily) => {
      subfamilies.push({
        path: `/${subfamily.fullPath || subfamily.basePath || ""}`,
        mocks: subfamily.mocks || [],
        subfamilies: subfamily.subfamilies || {},
        count: subfamily.count,
        isSubPath: true,
        subName: subfamily.basePath || "Unnamed",
        methods: subfamily.methods,
        hasNestedSubfamilies:
          subfamily.subfamilies &&
          Object.keys(subfamily.subfamilies).length > 0,
      });
    });
  }

  return subfamilies.sort((a, b) => {
    if (a.isMainPath && !b.isMainPath) return -1;
    if (!a.isMainPath && b.isMainPath) return 1;
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Ensure path is always a string before calling localeCompare
    const aPath = a.path || "";
    const bPath = b.path || "";
    return aPath.localeCompare(bPath);
  });
};
