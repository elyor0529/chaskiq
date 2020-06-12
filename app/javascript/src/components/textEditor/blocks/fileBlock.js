// IMPORTANT: this version has no file state

import React from "react";
import { EditorBlock, EditorState } from "draft-js";
import axios from "axios";
import {
  updateDataOfBlock,
  addNewBlockAt,
} from "Dante2/package/es/model/index.js";
import { close } from "Dante2/package/es/components/icons.js";
import {
  AttachmentIcon
} from '../../icons'

export default class FileBlock extends React.Component {
  constructor(props) {
    super(props);
    let existing_data = this.props.block.getData().toJS();

    this.config = this.props.blockProps.config;
    this.file = this.props.blockProps.data.get("file");
    this.state = {
      loading: false,
      selected: false,
      loading_progress: 0,
      caption: this.defaultPlaceholder(),
      direction: existing_data.direction || "center",
      width: 0,
      height: 0,
      //file: null,
      url: this.blockPropsSrc() || this.defaultUrl(existing_data),
      aspect_ratio: this.defaultAspectRatio(existing_data),
    };
  }

  componentDidMount() {
    //return this.replaceImg();
  }

  componentWillUnmount() {
    //debugger
  }

  blockPropsSrc = () => {
    return this.props.blockProps.data.src;
  };

  defaultUrl = (data) => {
    if (data.url) {
      return data.url;
    }

    if (data.url) {
      if (data.file) {
        return URL.createObjectURL(data.file);
      } else {
        return data.url;
      }
    } else {
      return this.props.blockProps.data.src;
    }
  };

  defaultPlaceholder = () => {
    return this.props.blockProps.config.image_caption_placeholder;
  };

  defaultAspectRatio = (data) => {
    if (data.aspect_ratio) {
      return {
        width: data.aspect_ratio["width"],
        height: data.aspect_ratio["height"],
        ratio: data.aspect_ratio["ratio"],
      };
    } else {
      return {
        width: 0,
        height: 0,
        ratio: 100,
      };
    }
  };

  // will update block state
  updateData = () => {
    let { blockProps, block } = this.props;
    let { getEditorState } = blockProps;
    let { setEditorState } = blockProps;
    let data = block.getData();
    let newData = data.merge(this.state).merge({ forceUpload: false });
    return setEditorState(updateDataOfBlock(getEditorState(), block, newData));
  };

  startLoader = () => {
    return this.setState({
      loading: true,
    });
  };

  stopLoader = () => {
    return this.setState({
      loading: false,
    });
  };

  handleUpload = () => {
    this.startLoader();
    this.updateData();
    return this.uploadFile();
  };

  updateDataSelection = () => {
    const { getEditorState, setEditorState } = this.props.blockProps;
    const newselection = getEditorState().getSelection().merge({
      anchorKey: this.props.block.getKey(),
      focusKey: this.props.block.getKey(),
    });

    return setEditorState(
      EditorState.forceSelection(getEditorState(), newselection)
    );
  };

  formatData = () => {
    let formData = new FormData();
    if (this.file) {
      let formName = this.config.upload_formName || "file";

      formData.append(formName, this.file);
      return formData;
    } else {
      formData.append("url", this.props.blockProps.data.get("url"));
      return formData;
    }
  };

  getUploadUrl = () => {
    let url = this.config.upload_url;
    if (typeof url === "function") {
      return url();
    } else {
      return url;
    }
  };

  getUploadHeaders() {
    return this.config.upload_headers || {};
  }

  uploadFile = () => {
    // custom upload handler
    if (this.config.upload_handler) {
      return this.config.upload_handler(this.formatData().get("file"), this);
    }

    if (!this.config.upload_url) {
      this.stopLoader();
      return;
    }

    this.props.blockProps.addLock();

    axios({
      method: "post",
      url: this.getUploadUrl(),
      headers: this.getUploadHeaders(),
      data: this.formatData(),
      onUploadProgress: (e) => {
        return this.updateProgressBar(e);
      },
    })
      .then((result) => {
        this.uploadCompleted(result.data.url);

        if (this.config.upload_callback) {
          return this.config.upload_callback(result, this);
        }
      })
      .catch((error) => {
        this.uploadFailed();

        console.log(`ERROR: got error uploading file ${error}`);
        if (this.config.upload_error_callback) {
          return this.config.upload_error_callback(error, this);
        }
      });

    return (json_response) => {
      return this.uploadCompleted(json_response.url);
    };
  };

  uploadFailed = () => {
    this.props.blockProps.removeLock();
    this.stopLoader();
  };

  uploadCompleted(url) {
    this.setState({ url }, this.updateData);
    this.props.blockProps.removeLock();
    this.stopLoader();
    this.file = null;
  }

  updateProgressBar(e) {
    let complete = this.state.loading_progress;
    if (e.lengthComputable) {
      complete = (e.loaded / e.total) * 100;
      complete = complete != null ? complete : { complete: 0 };
      this.setState({
        loading_progress: complete,
      });
      return console.log(`complete: ${complete}`);
    }
  }

  placeHolderEnabled = () => {
    return this.state.enabled || this.props.block.getText();
  };

  placeholderText = () => {
    return this.config.image_caption_placeholder || "caption here (optional)";
  };

  handleFocus(e) {}

  imageUrl = () => {
    if (this.state.url.includes("://")) return this.state.url;
    return `${this.config.domain ? this.config.domain : ""}${this.state.url}`;
  };

  render = () => {
    const fileName = this.state.url.split("/").pop()

    return (
      <div suppressContentEditableWarning={true}>
        <div contentEditable="false">
          
          {
            !this.state.loading && 
              <a href={this.state.url}
                target="blank" 
                className="flex items-center border rounded bg-gray-800 border-gray-600 p-4 py-2">
                <AttachmentIcon></AttachmentIcon> 
                {fileName}
              </a>
          }

          {
            this.state.loading && <Loader
              toggle={this.state.loading}
              progress={this.state.loading_progress}
            />
          }
          
        </div>

        <figcaption className="imageCaption" 
          onMouseDown={this.handleFocus}>
          {this.props.block.getText().length === 0 ? (
            <span className="danteDefaultPlaceholder">
              {this.placeholderText()}
            </span>
          ) : undefined}
          <EditorBlock
            {...Object.assign({}, this.props, {
              editable: true,
              className: "imageCaption",
            })}
          />
        </figcaption>
      </div>
    );
  };
}

class Loader extends React.Component {
  render = () => {
    return (
      <div>
        {this.props.toggle ? (
          <div className="image-upoader-loader">
            <p>
              {this.props.progress === 100 ? (
                "processing image..."
              ) : (
                <span>
                  <span>loading</span> {Math.round(this.props.progress)}
                </span>
              )}
            </p>
          </div>
        ) : undefined}
      </div>
    );
  };
}

export const FileBlockConfig = (options = {}) => {
  let config = {
    title: "add an image",
    type: "file",
    icon: AttachmentIcon,
    block: FileBlock,
    editable: true,
    renderable: true,
    breakOnContinuous: true,
    wrapper_class: "graf graf--figure",
    selected_class: "is-selected is-mediaFocused",
    selectedFn: (block) => {
      const { direction } = block.getData().toJS();
      switch (direction) {
        case "left":
          return "graf--layoutOutsetLeft";
        case "center":
          return "";
        case "wide":
          return "sectionLayout--fullWidth";
        case "fill":
          return "graf--layoutFillWidth";
        default:
          return "";
      }
    },
    handleEnterWithoutText(ctx, block) {
      const { editorState } = ctx.state;
      return ctx.onChange(addNewBlockAt(editorState, block.getKey()));
    },
    handleEnterWithText(ctx, block) {
      const { editorState } = ctx.state;
      return ctx.onChange(addNewBlockAt(editorState, block.getKey()));
    },
    widget_options: {
      displayOnInlineTooltip: true,
      insertion: "upload",
      insert_block: "file",
    },
    options: {
      upload_url: "",
      upload_headers: null,
      upload_formName: "file",
      upload_callback: null,
      upload_error_callback: null,
      delete_block_callback: null,
      image_caption_placeholder: "type a caption (optional)",
    },
  };

  return Object.assign(config, options);
};