//@flow
import React from "react";
import PropTypes from "prop-types";
import {
  View,
  ViewPropTypes,
  Platform,
  requireNativeComponent
} from "react-native";
import RNExtension from "./RNExtension";
import {
  RNWebGLBuffer,
  RNWebGLFramebuffer,
  RNWebGLObject,
  RNWebGLProgram,
  RNWebGLRenderbuffer,
  RNWebGLRenderingContext,
  RNWebGLShader,
  RNWebGLTexture
} from "./webglTypes";

export default class WebGLView extends React.Component {
  props: {
    onContextCreate: (gl: RNWebGLRenderingContext) => void,
    onContextFailure: (e: Error) => void,
    msaaSamples: number
  };
  static propTypes = {
    onContextCreate: PropTypes.func,
    onContextFailure: PropTypes.func,
    msaaSamples: PropTypes.number,
    ...ViewPropTypes
  };

  static defaultProps = {
    msaaSamples: 4
  };

  render() {
    const {
      onContextCreate,
      onContextFailure,
      msaaSamples,
      ...viewProps
    } = this.props;

    // NOTE: Removing `backgroundColor: "transparent"` causes a performance
    //       regression. Not sure why yet...
    return (
      <View {...viewProps}>
        <WebGLView.NativeView
          style={{ flex: 1, backgroundColor: "transparent" }}
          onSurfaceCreate={this.onSurfaceCreate}
          msaaSamples={Platform.OS === "ios" ? msaaSamples : undefined}
        />
      </View>
    );
  }

  onSurfaceCreate = ({
    nativeEvent: { ctxId }
  }: {
    nativeEvent: { ctxId: number }
  }) => {
    let gl, error;
    try {
      gl = getGl(ctxId);
      if (!gl) {
        error = new Error("RNWebGL context creation failed");
      }
    } catch (e) {
      error = e;
    }
    if (error) {
      if (this.props.onContextFailure) {
        this.props.onContextFailure(error);
      } else {
        throw error;
      }
    } else if (gl && this.props.onContextCreate) {
      this.props.onContextCreate(gl);
    }
  };

  static NativeView = requireNativeComponent("RNWebGLView", WebGLView, {
    nativeOnly: { onSurfaceCreate: true }
  });
}

// Many functions need wrapping/unwrapping of arguments and return value. We
// handle each case specifically so we can write the tightest code for
// better performance.
const wrapMethods = (gl, extension) => {
  const wrap = (methodNames, wrapper) =>
    (Array.isArray(methodNames) ? methodNames : [methodNames]).forEach(
      methodName => (gl[methodName] = wrapper(gl[methodName]))
    );

  // We can be slow in `gl.getParameter(...)` since it's a blocking call anyways
  const getParameterTypes = {
    [gl.ARRAY_BUFFER_BINDING]: WebGLBuffer,
    [gl.ELEMENT_ARRAY_BUFFER_BINDING]: WebGLBuffer,
    [gl.CURRENT_PROGRAM]: WebGLProgram,
    [gl.FRAMEBUFFER_BINDING]: WebGLFramebuffer,
    [gl.RENDERBUFFER_BINDING]: WebGLRenderbuffer,
    [gl.TEXTURE_BINDING_2D]: WebGLTexture,
    [gl.TEXTURE_BINDING_CUBE_MAP]: WebGLTexture
  };
  wrap("getParameter", orig => pname => {
    let ret = orig.call(gl, pname);
    if (pname === gl.VERSION) {
      // Wrap native version name
      ret = `WebGL 1.0 (react-native-webgl,${Platform.OS}) (${ret})`;
    }
    const type = getParameterTypes[pname];
    return type ? RNWebGLObject.wrap(type, ret) : ret;
  });

  // Buffers
  wrap("bindBuffer", orig => (target, buffer) =>
    orig.call(gl, target, buffer && buffer.id)
  );
  wrap("createBuffer", orig => () =>
    RNWebGLObject.wrap(RNWebGLBuffer, orig.call(gl))
  );
  wrap("deleteBuffer", orig => buffer => orig.call(gl, buffer && buffer.id));
  wrap("isBuffer", orig => buffer =>
    buffer instanceof WebGLBuffer && orig.call(gl, buffer.id)
  );

  // Framebuffers
  wrap("bindFramebuffer", orig => (target, framebuffer) =>
    orig.call(gl, target, framebuffer && framebuffer.id)
  );
  wrap("createFramebuffer", orig => () =>
    RNWebGLObject.wrap(RNWebGLFramebuffer, orig.call(gl))
  );
  wrap("deleteFramebuffer", orig => framebuffer =>
    orig.call(gl, framebuffer && framebuffer.id)
  );
  wrap("framebufferRenderbuffer", orig => (target, attachment, rbtarget, rb) =>
    orig.call(gl, target, attachment, rbtarget, rb && rb.id)
  );
  wrap(
    "framebufferTexture2D",
    orig => (target, attachment, textarget, tex, level) =>
      orig.call(gl, target, attachment, textarget, tex && tex.id, level)
  );
  wrap("isFramebuffer", orig => framebuffer =>
    framebuffer instanceof WebGLFramebuffer && orig.call(gl, framebuffer.id)
  );

  // Renderbuffers
  wrap("bindRenderbuffer", orig => (target, renderbuffer) =>
    orig.call(gl, target, renderbuffer && renderbuffer.id)
  );
  wrap("createRenderbuffer", orig => () =>
    RNWebGLObject.wrap(RNWebGLRenderbuffer, orig.call(gl))
  );
  wrap("deleteRenderbuffer", orig => renderbuffer =>
    orig.call(gl, renderbuffer && renderbuffer.id)
  );
  wrap("isRenderbuffer", orig => renderbuffer =>
    renderbuffer instanceof WebGLRenderbuffer && orig.call(gl, renderbuffer.id)
  );

  // Textures
  wrap("bindTexture", orig => (target, texture) =>
    orig.call(gl, target, texture && texture.id)
  );
  wrap("createTexture", orig => () =>
    RNWebGLObject.wrap(RNWebGLTexture, orig.call(gl))
  );
  wrap("deleteTexture", orig => texture =>
    orig.call(gl, texture && texture.id)
  );
  wrap("isTexture", orig => texture =>
    texture instanceof WebGLTexture && orig.call(gl, texture.id)
  );

  // Programs and shaders
  wrap("attachShader", orig => (program, shader) =>
    orig.call(gl, program && program.id, shader && shader.id)
  );
  wrap("bindAttribLocation", orig => (program, index, name) =>
    orig.call(gl, program && program.id, index, name)
  );
  wrap("compileShader", orig => shader => orig.call(gl, shader && shader.id));
  wrap("createProgram", orig => () =>
    RNWebGLObject.wrap(RNWebGLProgram, orig.call(gl))
  );
  wrap("createShader", orig => type =>
    RNWebGLObject.wrap(RNWebGLShader, orig.call(gl, type))
  );
  wrap("deleteProgram", orig => program =>
    orig.call(gl, program && program.id)
  );
  wrap("deleteShader", orig => shader => orig.call(gl, shader && shader.id));
  wrap("detachShader", orig => (program, shader) =>
    orig.call(gl, program && program.id, shader && shader.id)
  );
  wrap("getAttachedShaders", orig => program =>
    orig
      .call(gl, program && program.id)
      .map(id => RNWebGLObject.wrap(RNWebGLShader, id))
  );
  wrap("getProgramParameter", orig => (program, pname) =>
    orig.call(gl, program && program.id, pname)
  );
  wrap("getProgramInfoLog", orig => program =>
    orig.call(gl, program && program.id)
  );
  wrap("getShaderParameter", orig => (shader, pname) =>
    orig.call(gl, shader && shader.id, pname)
  );
  wrap("getShaderPrecisionFormat", orig => (shadertype, precisiontype) =>
    // $FlowFixMe
    new WebGLShaderPrecisionFormat(orig.call(gl, shadertype, precisiontype))
  );
  wrap("getShaderInfoLog", orig => shader =>
    orig.call(gl, shader && shader.id)
  );
  wrap("getShaderSource", orig => shader => orig.call(gl, shader && shader.id));
  wrap("linkProgram", orig => program => orig.call(gl, program && program.id));
  wrap("shaderSource", orig => (shader, source) =>
    orig.call(gl, shader && shader.id, source)
  );
  wrap("useProgram", orig => program => orig.call(gl, program && program.id));
  wrap("validateProgram", orig => program =>
    orig.call(gl, program && program.id)
  );
  wrap("isShader", orig => shader =>
    shader instanceof WebGLShader && orig.call(gl, shader.id)
  );
  wrap("isProgram", orig => program =>
    program instanceof WebGLProgram && orig.call(gl, program.id)
  );

  wrap("getExtension", orig => id => {
    if (id === "RN") return extension;
    return orig.call(gl, id);
  });

  // Uniforms and attributes
  wrap("getActiveAttrib", orig => (program, index) =>
    // $FlowFixMe
    new WebGLActiveInfo(orig.call(gl, program && program.id, index))
  );
  wrap("getActiveUniform", orig => (program, index) =>
    // $FlowFixMe
    new WebGLActiveInfo(orig.call(gl, program && program.id, index))
  );
  wrap("getAttribLocation", orig => (program, name) =>
    orig.call(gl, program && program.id, name)
  );
  wrap("getUniform", orig => (program, location) =>
    orig.call(gl, program && program.id, location && location.id)
  );
  wrap("getUniformLocation", orig => (program, name) =>
    // $FlowFixMe
    new WebGLUniformLocation(orig.call(gl, program && program.id, name))
  );
  wrap(["uniform1f", "uniform1i"], orig => (loc, x) =>
    orig.call(gl, loc && loc.id, x)
  );
  wrap(["uniform2f", "uniform2i"], orig => (loc, x, y) =>
    orig.call(gl, loc && loc.id, x, y)
  );
  wrap(["uniform3f", "uniform3i"], orig => (loc, x, y, z) =>
    orig.call(gl, loc && loc.id, x, y, z)
  );
  wrap(["uniform4f", "uniform4i"], orig => (loc, x, y, z, w) =>
    orig.call(gl, loc && loc.id, x, y, z, w)
  );
  wrap(
    ["uniform1fv", "uniform2fv", "uniform3fv", "uniform4fv"],
    orig => (loc, val) => orig.call(gl, loc && loc.id, new Float32Array(val))
  );
  wrap(
    ["uniform1iv", "uniform2iv", "uniform3iv", "uniform4iv"],
    orig => (loc, val) => orig.call(gl, loc && loc.id, new Int32Array(val))
  );
  wrap(
    ["uniformMatrix2fv", "uniformMatrix3fv", "uniformMatrix4fv"],
    orig => (loc, transpose, val) =>
      orig.call(gl, loc && loc.id, transpose, new Float32Array(val))
  );
  wrap(
    [
      "vertexAttrib1fv",
      "vertexAttrib2fv",
      "vertexAttrib3fv",
      "vertexAttrib4fv"
    ],
    orig => (index, val) => orig.call(gl, index, new Float32Array(val))
  );
};

// Get the GL interface from an RNWebGLContextID and do JS-side setup
const getGl = (ctxId: number): ?RNWebGLRenderingContext => {
  if (!global.__RNWebGLContexts) {
    console.warn(
      "RNWebGL: Can only run on JavaScriptCore! Do you have 'Remote Debugging' enabled in your app's Developer Menu (https://facebook.github.io/react-native/docs/debugging.html)? RNWebGL is not supported while using Remote Debugging, you will need to disable it to use RNWebGL."
    );
    return null;
  }
  const gl = global.__RNWebGLContexts[ctxId];
  gl.__ctxId = ctxId;
  delete global.__RNWebGLContexts[ctxId];
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(gl, global.WebGLRenderingContext.prototype);
  } else {
    gl.__proto__ = global.WebGLRenderingContext.prototype;
  }
  wrapMethods(gl, RNExtension.createWithContext(gl, ctxId));

  gl.canvas = null;

  const viewport = gl.getParameter(gl.VIEWPORT);
  gl.drawingBufferWidth = viewport[2];
  gl.drawingBufferHeight = viewport[3];

  return gl;
};
